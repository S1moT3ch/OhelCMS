import secrets
from typing import Optional, Dict, Any
import redis

from core.config import (
    ADMIN_PASSWORD,
    REDIS_PREFIX_ADMIN_SESSION,
    REDIS_PREFIX_SURVEY,
    REDIS_KEY_USERS,
    REDIS_KEY_SURVEYS,
)
from services.users_service import get_all_soci
from services.surveys_service import get_all_surveys


def authenticate_admin(password: str) -> bool:
    """Verifica la password fornita con la variabile d'ambiente ADMIN_PASSWORD."""
    if not password:
        return False
    return secrets.compare_digest(password, ADMIN_PASSWORD)


def create_admin_session(r: redis.Redis, password: str) -> Optional[str]:
    """Se la password è corretta, genera e salva una sessione admin in Redis valida 24h."""
    if not authenticate_admin(password):
        return None

    session_token = secrets.token_urlsafe(32)
    session_key = f"{REDIS_PREFIX_ADMIN_SESSION}{session_token}"
    # Sessione salvata per 24 ore (86400 secondi)
    r.setex(session_key, 86400, "1")
    return session_token


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
    - Statistiche aggregate
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

    stats = {
        "totalUsers": len(users),
        "adminUsers": sum(1 for u in users if u.get("isAdmin")),
        "activeSurveys": sum(1 for s in surveys if s.get("status") == "ATTIVO"),
        "totalSurveys": len(surveys),
        "totalVotes": total_votes_overall
    }

    return {
        "status": "success",
        "stats": stats,
        "users": users,
        "surveys": surveys_with_vote_counts
    }

