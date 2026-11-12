import hmac
import hashlib
import time
import struct
import base64
import secrets
from typing import Optional, Dict, Any
import redis

from core.config import (
    ADMIN_PASSWORD,
    ADMIN_MFA_SECRET,
    REDIS_KEY_ADMIN_MFA,
    REDIS_PREFIX_ADMIN_SESSION,
    REDIS_PREFIX_SURVEY,
    REDIS_KEY_USERS,
    REDIS_KEY_SURVEYS,
)
from services.users_service import get_all_soci
from services.surveys_service import get_all_surveys
from services.logs_service import get_logs, get_logs_count


def generate_mfa_secret() -> str:
    """Genera una chiave segreta Base32 casuale a 20 byte (32 caratteri) per TOTP."""
    base32_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    return "".join(secrets.choice(base32_chars) for _ in range(32))


def get_admin_mfa_secret(r: redis.Redis) -> Optional[str]:
    """
    Recupera il segreto MFA attivo per l'amministratore.
    Priorità: 1. Variabile d'ambiente ADMIN_MFA_SECRET 2. Valore memorizzato in Redis.
    """
    if ADMIN_MFA_SECRET:
        return ADMIN_MFA_SECRET
    raw = r.get(REDIS_KEY_ADMIN_MFA)
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return str(raw).strip().replace(" ", "").upper() or None


def set_admin_mfa_secret(r: redis.Redis, secret: str) -> None:
    """Salva il segreto Base32 MFA in Redis."""
    clean = str(secret).strip().replace(" ", "").upper()
    r.set(REDIS_KEY_ADMIN_MFA, clean)


def delete_admin_mfa_secret(r: redis.Redis) -> None:
    """Rimuove il segreto MFA da Redis (disattivazione 2FA)."""
    r.delete(REDIS_KEY_ADMIN_MFA)


def is_mfa_configured(r: redis.Redis) -> bool:
    """Indica se l'autenticazione a due fattori con Authenticator è attiva per l'admin."""
    return bool(get_admin_mfa_secret(r))


def verify_totp(token: str, secret_base32: str, valid_window: int = 1) -> bool:
    """
    Verifica un codice a 6 cifre con l'algoritmo standard RFC 6238 (TOTP).
    Supporta Google Authenticator, Microsoft Authenticator, 1Password, Authy, ecc.
    Finestra di tolleranza di +/- valid_window step (30s) per compensare drift dell'orologio.
    """
    if not token or not secret_base32:
        return False

    clean_token = str(token).strip().replace(" ", "")
    if len(clean_token) != 6 or not clean_token.isdigit():
        return False

    secret_clean = str(secret_base32).strip().replace(" ", "").upper()
    missing_padding = len(secret_clean) % 8
    if missing_padding:
        secret_clean += "=" * (8 - missing_padding)

    try:
        key = base64.b32decode(secret_clean, casefold=True)
    except Exception:
        return False

    current_counter = int(time.time() // 30)

    for i in range(-valid_window, valid_window + 1):
        counter = current_counter + i
        msg = struct.pack(">Q", counter)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        code = (struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
        candidate = str(code).zfill(6)
        if secrets.compare_digest(candidate, clean_token):
            return True

    return False


def authenticate_admin(password: str) -> bool:
    """Verifica la password fornita con la variabile d'ambiente ADMIN_PASSWORD."""
    if not password:
        return False
    return secrets.compare_digest(password, ADMIN_PASSWORD)


def create_admin_session(
    r: redis.Redis,
    password: str,
    otp_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Autentica l'amministratore con Password e (se configurata) App Authenticator.
    Restituisce un dizionario con lo stato dell'operazione e il token di sessione valido 24h.
    """
    if not authenticate_admin(password):
        return {
            "success": False,
            "status": "error",
            "message": "Password non corretta."
        }

    mfa_secret = get_admin_mfa_secret(r)

    # Se la MFA è attiva, richiediamo e convalidiamo il codice a 6 cifre dall'app
    if mfa_secret:
        if not otp_code or not str(otp_code).strip():
            return {
                "success": False,
                "status": "mfa_required",
                "message": "Codice App Authenticator (2FA) richiesto per completare l'accesso."
            }

        if not verify_totp(str(otp_code).strip(), mfa_secret):
            return {
                "success": False,
                "status": "error",
                "message": "Codice App Authenticator non valido o scaduto."
            }

    session_token = secrets.token_urlsafe(32)
    session_key = f"{REDIS_PREFIX_ADMIN_SESSION}{session_token}"
    # Sessione salvata per 24 ore (86400 secondi)
    r.setex(session_key, 86400, "1")

    return {
        "success": True,
        "status": "success",
        "token": session_token,
        "mfaActive": bool(mfa_secret)
    }


def verify_admin_session(r: redis.Redis, session_token: Optional[str]) -> bool:
    """Verifica se il token di sessione admin è presente e valido in Redis."""
    if not session_token:
        return False
    session_key = f"{REDIS_PREFIX_ADMIN_SESSION}{session_token.strip()}"
    return bool(r.exists(session_key))


def delete_admin_session(r: redis.Redis, session_token: Optional[str]) -> None:
    """Elimina la sessione admin (logout)."""
    if session_token:
        session_key = f"{REDIS_PREFIX_ADMIN_SESSION}{session_token.strip()}"
        r.delete(session_key)


def get_admin_dashboard_data(r: redis.Redis) -> Dict[str, Any]:
    """
    Raccoglie in un'unica chiamata tutti i dati del database per la dashboard amministratore:
    - Lista soci e permessi
    - Lista sondaggi con conteggio partecipanti
    - Statistiche aggregate e stato MFA
    """
    users = get_all_soci(r)
    surveys = get_all_surveys(r)

    total_votes_overall = 0
    surveys_with_vote_counts = []

    for surv in surveys:
        sid = surv.get("idSondaggio")
        votes_key = f"{REDIS_PREFIX_SURVEY}{sid}:votes"
        v_count = r.hlen(votes_key)
        total_votes_overall += v_count

        s_copy = dict(surv)
        s_copy["votesCount"] = v_count
        surveys_with_vote_counts.append(s_copy)

    mfa_configured = is_mfa_configured(r)
    logs = get_logs(r, limit=150)
    total_logs = get_logs_count(r)

    stats = {
        "totalUsers": len(users),
        "adminUsers": sum(1 for u in users if u.get("isAdmin")),
        "activeSurveys": sum(1 for s in surveys if s.get("status") == "ATTIVO"),
        "totalSurveys": len(surveys),
        "totalVotes": total_votes_overall,
        "totalLogs": total_logs,
        "mfaActive": mfa_configured,
        "mfaEnforcedByEnv": bool(ADMIN_MFA_SECRET)
    }

    return {
        "status": "success",
        "stats": stats,
        "users": users,
        "surveys": surveys_with_vote_counts,
        "logs": logs,
        "mfa": {
            "active": mfa_configured,
            "enforcedByEnv": bool(ADMIN_MFA_SECRET)
        }
    }

