import json
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import redis

from core.config import REDIS_PREFIX_SURVEY, REDIS_KEY_SURVEYS
from services.users_service import get_socio

def normalize_dates(raw_dates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalizza la struttura delle date per garantire consistenza nel database."""
    dates_normalized = []
    for d in raw_dates:
        time_range = d.get("timeRange", {})
        if not isinstance(time_range, dict):
            time_range = {"start": "", "end": ""}
        
        time_slots = d.get("timeSlots", [])
        if isinstance(time_slots, str):
            time_slots = [s.strip() for s in time_slots.split(",") if s.strip()]

        dates_normalized.append({
            "date": str(d.get("date", "")),
            "timeRange": {
                "start": str(time_range.get("start", "")),
                "end": str(time_range.get("end", ""))
            },
            "subtitle": str(d.get("subtitle", "") or ""),
            "timeSlots": time_slots,
            "notes": str(d.get("notes", "") or "")
        })
    return dates_normalized

def get_survey_by_id(r: redis.Redis, id_sondaggio: str) -> Optional[Dict[str, Any]]:
    """Recupera il record JSON grezzo di un sondaggio dato il suo ID."""
    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    raw = r.get(survey_key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None

def extract_vote_timestamp(vdata: Dict[str, Any]) -> int:
    """Estrae il timestamp in millisecondi di un voto, con fallback dal campo timestamp testuale."""
    if vdata.get("votedAt"):
        try:
            return int(vdata["votedAt"])
        except Exception:
            pass
    ts_str = str(vdata.get("timestamp", "")).strip()
    if ts_str:
        for fmt in (
            "%d/%m/%Y %H.%M.%S",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
        ):
            try:
                dt = datetime.strptime(ts_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return int(dt.timestamp() * 1000)
            except Exception:
                pass
        try:
            clean_ts = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except Exception:
            pass
    return 0

def get_active_surveys(r: redis.Redis, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Restituisce tutti i sondaggi con Stato == 'ATTIVO'.
    Se user_email è fornita, calcola:
    - 'voted': se l'utente ha già risposto
    - 'needsUpdate': True se l'amministratore ha modificato il sondaggio DOPO la compilazione dell'utente.
    Replica GET_ACTIVE_SURVEYS di GAS.
    """
    clean_email = user_email.lower().strip() if user_email else None
    socio_nome_completo = ""

    if clean_email:
        socio = get_socio(r, clean_email)
        if socio:
            socio_nome_completo = f"{socio.get('nome', '')} {socio.get('cognome', '')}".lower().strip()

    survey_ids = r.zrange(REDIS_KEY_SURVEYS, 0, -1)
    active_surveys = []

    for sid in survey_ids:
        raw = r.get(f"{REDIS_PREFIX_SURVEY}{sid}")
        if not raw:
            continue
        try:
            survey = json.loads(raw)
        except Exception:
            continue

        if survey.get("status") == "ATTIVO":
            voted = False
            user_last_voted_at = 0

            if clean_email:
                # Controlla le risposte registrate in questo sondaggio
                votes_key = f"{REDIS_PREFIX_SURVEY}{sid}:votes"
                all_votes = r.hgetall(votes_key)
                for member_name, vote_raw in all_votes.items():
                    try:
                        vdata = json.loads(vote_raw)
                        submitter = vdata.get("submittedByEmail", "").lower().strip()
                        m_name = member_name.lower().strip()
                        if submitter == clean_email or (socio_nome_completo and m_name == socio_nome_completo):
                            voted = True
                            v_time = extract_vote_timestamp(vdata)
                            if v_time > user_last_voted_at:
                                user_last_voted_at = v_time
                    except Exception:
                        pass

            # Controllo se il sondaggio è stato aggiornato dall'admin DOPO che l'utente ha votato
            updated_at = survey.get("updatedAt")
            needs_update = False
            if voted and updated_at and user_last_voted_at:
                try:
                    if int(updated_at) > int(user_last_voted_at):
                        needs_update = True
                except Exception:
                    pass

            active_surveys.append({
                "idSondaggio": sid,
                "title": survey.get("title", ""),
                "description": survey.get("description", ""),
                "status": survey.get("status", "ATTIVO"),
                "voted": voted,
                "needsUpdate": needs_update,
                "userLastVotedAt": user_last_voted_at if voted else None,
                "dates": survey.get("dates", []),
                "createdBy": survey.get("createdBy", ""),
                "createdByName": survey.get("createdByName", ""),
                "createdAt": survey.get("createdAt", None),
                "updatedAt": updated_at
            })

    return active_surveys

def get_all_surveys(r: redis.Redis) -> List[Dict[str, Any]]:
    """
    Restituisce tutti i sondaggi presenti nel database (attivi e disattivati).
    Replica GET_ALL_SURVEYS di GAS.
    """
    survey_ids = r.zrange(REDIS_KEY_SURVEYS, 0, -1)
    all_surveys = []

    for sid in survey_ids:
        raw = r.get(f"{REDIS_PREFIX_SURVEY}{sid}")
        if not raw:
            continue
        try:
            survey = json.loads(raw)
        except Exception:
            continue

        all_surveys.append({
            "idSondaggio": sid,
            "title": survey.get("title", ""),
            "description": survey.get("description", ""),
            "status": survey.get("status", "ATTIVO"),
            "dates": survey.get("dates", []),
            "createdBy": survey.get("createdBy", ""),
            "createdByName": survey.get("createdByName", ""),
            "createdAt": survey.get("createdAt", None),
            "updatedAt": survey.get("updatedAt", None)
        })

    return all_surveys

def create_survey(r: redis.Redis, payload: Dict[str, Any], creator_email: Optional[str] = None, creator_name: Optional[str] = None) -> str:
    """
    Crea un nuovo sondaggio e lo memorizza in Redis.
    Replica CREATE_SURVEY di GAS.
    """
    id_sondaggio = f"SURV_{int(time.time() * 1000)}"

    dates_normalized = normalize_dates(payload.get("dates", []))

    creator = (creator_email or payload.get("createdBy", "")).lower().strip()
    c_name = str(creator_name or payload.get("createdByName", "")).strip()

    survey_data = {
        "idSondaggio": id_sondaggio,
        "title": str(payload.get("title", "")),
        "description": str(payload.get("description", "")),
        "status": "ATTIVO",
        "createdAt": int(time.time() * 1000),
        "createdBy": creator,
        "createdByName": c_name,
        "dates": dates_normalized
    }

    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    r.set(survey_key, json.dumps(survey_data, ensure_ascii=False))
    r.zadd(REDIS_KEY_SURVEYS, {id_sondaggio: time.time()})

    return id_sondaggio

def update_survey(r: redis.Redis, id_sondaggio: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggiorna il contenuto di un sondaggio esistente (titolo, descrizione, stato, date).
    Mantiene intatti ID, storico voti, data di creazione e autore originale.
    """
    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    survey = get_survey_by_id(r, id_sondaggio)
    if not survey:
        return {"status": "error", "message": f"Sondaggio con ID '{id_sondaggio}' non trovato."}

    if "title" in payload:
        survey["title"] = str(payload.get("title", ""))
    if "description" in payload:
        survey["description"] = str(payload.get("description", ""))
    if "status" in payload and payload.get("status"):
        survey["status"] = str(payload.get("status"))
    if "dates" in payload:
        survey["dates"] = normalize_dates(payload.get("dates", []))

    survey["updatedAt"] = int(time.time() * 1000)

    r.set(survey_key, json.dumps(survey, ensure_ascii=False))

    return {
        "status": "success",
        "message": "Sondaggio aggiornato con successo!",
        "idSondaggio": id_sondaggio,
        "survey": survey
    }

def toggle_survey_status(r: redis.Redis, id_sondaggio: str, new_status: str) -> Dict[str, Any]:
    """
    Aggiorna lo stato di un sondaggio (es. 'ATTIVO' <-> 'DISATTIVATO').
    Replica TOGGLE_SURVEY_STATUS di GAS.
    """
    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    raw = r.get(survey_key)
    if not raw:
        return {"status": "error", "message": f"Sondaggio con ID '{id_sondaggio}' non trovato."}

    try:
        survey = json.loads(raw)
    except Exception:
        return {"status": "error", "message": "Dati sondaggio corrotti."}

    survey["status"] = new_status
    r.set(survey_key, json.dumps(survey, ensure_ascii=False))

    return {
        "status": "success",
        "message": f"Sondaggio {'attivato' if new_status == 'ATTIVO' else 'disattivato'} con successo!",
        "updatedRows": 1,
        "newStatus": new_status
    }

def delete_survey(r: redis.Redis, id_sondaggio: str) -> Dict[str, Any]:
    """
    Elimina un sondaggio e tutte le risposte associate.
    Replica DELETE_SURVEY di GAS.
    """
    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    votes_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}:votes"

    votes_count = r.hlen(votes_key)

    r.delete(survey_key)
    r.delete(votes_key)
    r.zrem(REDIS_KEY_SURVEYS, id_sondaggio)

    return {
        "status": "success",
        "message": "Sondaggio e relative risposte eliminati con successo!",
        "deletedConfigRows": 1,
        "deletedResponseRows": votes_count
    }

