import json
import time
import secrets
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import redis

from core.config import (
    REDIS_KEY_LOGS_INDEX,
    REDIS_PREFIX_LOG,
    LOG_RETENTION_SECONDS
)

def add_log(
    r: redis.Redis,
    action: str,
    description: str,
    source: str = "backend",
    user_email: Optional[str] = None,
    user_name: Optional[str] = None,
    level: str = "INFO",
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Registra un'operazione nei log di audit sia da frontend che da backend.
    Ogni log si autoelimina esattamente dopo 30 giorni (TTL in Redis e zremrangebyscore).
    """
    try:
        now = datetime.now(timezone.utc)
        now_ms = int(now.timestamp() * 1000)
        random_suffix = secrets.token_hex(3)
        log_id = f"LOG_{now_ms}_{random_suffix}"

        clean_email = (user_email or "").strip().lower()
        clean_name = (user_name or "").strip()
        clean_source = source.strip().lower() if source else "backend"
        clean_level = level.strip().upper() if level else "INFO"

        log_entry = {
            "id": log_id,
            "timestamp": now.strftime("%d/%m/%Y %H:%M:%S"),
            "timestampMs": now_ms,
            "source": clean_source,   # "frontend" | "backend"
            "action": action.strip().upper(),
            "level": clean_level,     # "INFO" | "SUCCESS" | "WARNING" | "ERROR"
            "description": description.strip(),
            "userEmail": clean_email or "Sistema",
            "userName": clean_name,
            "ip": (ip_address or "").strip(),
            "metadata": metadata or {}
        }

        # 1. Salva la singola voce con TTL di 30 giorni
        log_key = f"{REDIS_PREFIX_LOG}{log_id}"
        r.setex(log_key, LOG_RETENTION_SECONDS, json.dumps(log_entry, ensure_ascii=False))

        # 2. Inserisce l'ID nell'indice cronologico (Sorted Set ordinato per timestamp_ms)
        r.zadd(REDIS_KEY_LOGS_INDEX, {log_id: now_ms})

        # 3. Pulizia automatica immediata di voci antecedenti a 30 giorni (30 * 86400 * 1000 ms)
        cutoff_ms = int((time.time() - LOG_RETENTION_SECONDS) * 1000)
        r.zremrangebyscore(REDIS_KEY_LOGS_INDEX, "-inf", cutoff_ms)

        return log_entry
    except Exception as e:
        print(f"[LOG ERROR] Impossibile salvare log: {e}")
        return {}

def get_logs(
    r: redis.Redis,
    limit: int = 250,
    offset: int = 0,
    source_filter: Optional[str] = None,
    level_filter: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Recupera l'elenco dei log recenti, applicando automaticamente la scadenza a 30 giorni
    ed eventuali filtri per sorgente (frontend/backend), gravità o testo di ricerca.
    """
    try:
        # Pulisce sempre l'indice dalle voci più vecchie di 30 giorni
        cutoff_ms = int((time.time() - LOG_RETENTION_SECONDS) * 1000)
        r.zremrangebyscore(REDIS_KEY_LOGS_INDEX, "-inf", cutoff_ms)

        # Legge gli ID più recenti dal Sorted Set
        # Prendiamo un margine più ampio per permettere il filtraggio in memoria se richiesto
        fetch_count = max(limit + offset, 500)
        log_ids = r.zrevrange(REDIS_KEY_LOGS_INDEX, 0, fetch_count - 1)
        if not log_ids:
            return []

        keys = [f"{REDIS_PREFIX_LOG}{lid}" for lid in log_ids]
        raw_items = r.mget(keys)

        logs = []
        expired_ids = []

        for lid, raw in zip(log_ids, raw_items):
            if not raw:
                # La chiave è scaduta tramite TTL Redis, annotiamo l'ID per pulirlo dall'indice
                expired_ids.append(lid)
                continue
            try:
                item = json.loads(raw)
                logs.append(item)
            except Exception:
                expired_ids.append(lid)

        # Rimuove dall'indice gli ID i cui dati sono scaduti
        if expired_ids:
            try:
                r.zrem(REDIS_KEY_LOGS_INDEX, *expired_ids)
            except Exception:
                pass

        # Filtri opzionali
        if source_filter and source_filter.upper() != "ALL":
            s_filter = source_filter.lower().strip()
            logs = [lg for lg in logs if lg.get("source", "").lower() == s_filter]

        if level_filter and level_filter.upper() != "ALL":
            lvl_filter = level_filter.upper().strip()
            logs = [lg for lg in logs if lg.get("level", "").upper() == lvl_filter]

        if search:
            q = search.lower().strip()
            logs = [
                lg for lg in logs
                if q in lg.get("description", "").lower()
                or q in lg.get("action", "").lower()
                or q in lg.get("userEmail", "").lower()
                or q in lg.get("userName", "").lower()
                or q in lg.get("ip", "").lower()
            ]

        # Paginazione
        return logs[offset:offset + limit]

    except Exception as e:
        print(f"[LOG ERROR] Impossibile recuperare log: {e}")
        return []

def get_logs_count(r: redis.Redis) -> int:
    """Restituisce il numero totale di log attualmente presenti nei 30 giorni."""
    try:
        cutoff_ms = int((time.time() - LOG_RETENTION_SECONDS) * 1000)
        r.zremrangebyscore(REDIS_KEY_LOGS_INDEX, "-inf", cutoff_ms)
        return r.zcard(REDIS_KEY_LOGS_INDEX) or 0
    except Exception:
        return 0

def clear_all_logs(r: redis.Redis) -> int:
    """Elimina tutti i log presenti (funzione amministrativa)."""
    try:
        log_ids = r.zrange(REDIS_KEY_LOGS_INDEX, 0, -1)
        if log_ids:
            keys = [f"{REDIS_PREFIX_LOG}{lid}" for lid in log_ids]
            r.delete(*keys)
        r.delete(REDIS_KEY_LOGS_INDEX)
        return len(log_ids)
    except Exception:
        return 0

