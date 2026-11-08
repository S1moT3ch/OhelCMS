import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import redis

from core.config import REDIS_PREFIX_USER, REDIS_KEY_USERS

def get_socio(r: redis.Redis, email: str) -> Optional[Dict[str, Any]]:
    """
    Recupera i dati del socio dato il suo indirizzo email.
    Replica esattamente getSocio di GAS.
    """
    if not email:
        return None

    clean_email = email.lower().strip()
    user_key = f"{REDIS_PREFIX_USER}{clean_email}"
    data = r.hgetall(user_key)
    
    if not data:
        return None

    is_admin_raw = data.get("isAdmin", "")
    is_admin = is_admin_raw is True or str(is_admin_raw).lower() in ("true", "1")

    return {
        "idGoogle": data.get("idGoogle", ""),
        "nome": data.get("nome", ""),
        "cognome": data.get("cognome", ""),
        "email": data.get("email", clean_email),
        "picture": (data.get("picture") or "").replace(" ", ""),
        "isAdmin": is_admin
    }

def salva_nuovo_socio(r: redis.Redis, payload: Dict[str, Any]) -> None:
    """
    Salva un nuovo socio in Redis.
    Replica esattamente salvaNuovoSocio di GAS.
    """
    email = payload.get("email", "").lower().strip()
    if not email:
        raise ValueError("Email mancante nel payload di registrazione.")

    user_key = f"{REDIS_PREFIX_USER}{email}"
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H.%M.%S")

    user_data = {
        "idGoogle": str(payload.get("idGoogle", "")),
        "nome": str(payload.get("nome", "")),
        "cognome": str(payload.get("cognome", "")),
        "email": email,
        "picture": str(payload.get("picture", "")),
        "dataRegistrazione": now_str,
        "isAdmin": "false"
    }

    r.hset(user_key, mapping=user_data)
    r.sadd(REDIS_KEY_USERS, email)

def check_admin_permissions(r: redis.Redis, email: str) -> Dict[str, Any]:
    """
    Verifica se l'utente ha i permessi di amministratore.
    Replica checkAdminPermissions di GAS.
    """
    socio = get_socio(r, email)
    if not socio:
        return {
            "authorized": False,
            "message": "Utente non presente nei registri dell'associazione."
        }
    if not socio.get("isAdmin"):
        return {
            "authorized": False,
            "message": "Azione negata: sono richiesti i permessi di Amministratore."
        }
    return {
        "authorized": True,
        "socio": socio
    }

def get_all_soci(r: redis.Redis) -> list[Dict[str, Any]]:
    """
    Restituisce l'elenco completo di tutti i soci registrati in Redis.
    """
    emails = r.smembers(REDIS_KEY_USERS)
    users = []
    for email in sorted(emails):
        socio = get_socio(r, email)
        if socio:
            user_key = f"{REDIS_PREFIX_USER}{email}"
            reg_date = r.hget(user_key, "dataRegistrazione") or ""
            socio["dataRegistrazione"] = reg_date
            users.append(socio)
    return users

def set_user_admin_status(r: redis.Redis, email: str, is_admin: bool) -> Dict[str, Any]:
    """
    Aggiorna lo stato di amministratore per un utente specifico ('battezza' o revoca admin).
    """
    clean_email = email.lower().strip()
    socio = get_socio(r, clean_email)
    if not socio:
        return {"status": "error", "message": f"Utente '{clean_email}' non trovato."}

    user_key = f"{REDIS_PREFIX_USER}{clean_email}"
    admin_str = "true" if is_admin else "false"
    r.hset(user_key, mapping={"isAdmin": admin_str})

    return {
        "status": "success",
        "message": f"Utente {clean_email} {'promosso ad Amministratore' if is_admin else 'riportato a Socio standard'}!",
        "email": clean_email,
        "isAdmin": is_admin
    }

def delete_user(r: redis.Redis, email: str) -> Dict[str, Any]:
    """
    Elimina un utente dal database Redis.
    """
    clean_email = email.lower().strip()
    user_key = f"{REDIS_PREFIX_USER}{clean_email}"
    r.delete(user_key)
    r.srem(REDIS_KEY_USERS, clean_email)
    return {
        "status": "success",
        "message": f"Utente {clean_email} eliminato con successo dal database."
    }


