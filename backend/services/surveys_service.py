import json
import time
from typing import Optional, List, Dict, Any
import redis

from core.config import REDIS_PREFIX_SURVEY, REDIS_KEY_SURVEYS
from services.users_service import get_socio

def get_active_surveys(r: redis.Redis, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Restituisce tutti i sondaggi con Stato == 'ATTIVO'.
    Se user_email è fornita, calcola il campo 'voted' per ciascun sondaggio.
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
                            break
                    except Exception:
                        pass

            active_surveys.append({
                "idSondaggio": sid,
                "title": survey.get("title", ""),
                "description": survey.get("description", ""),
                "status": survey.get("status", "ATTIVO"),
                "voted": voted,
                "dates": survey.get("dates", [])
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
            "dates": survey.get("dates", [])
        })

    return all_surveys

def create_survey(r: redis.Redis, payload: Dict[str, Any]) -> str:
    """
    Crea un nuovo sondaggio e lo memorizza in Redis.
    Replica CREATE_SURVEY di GAS.
    """
    id_sondaggio = f"SURV_{int(time.time() * 1000)}"

    dates_normalized = []
    for d in payload.get("dates", []):
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

    survey_data = {
        "idSondaggio": id_sondaggio,
        "title": str(payload.get("title", "")),
        "description": str(payload.get("description", "")),
        "status": "ATTIVO",
        "createdAt": int(time.time() * 1000),
        "dates": dates_normalized
    }

    survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
    r.set(survey_key, json.dumps(survey_data, ensure_ascii=False))
    r.zadd(REDIS_KEY_SURVEYS, {id_sondaggio: time.time()})

    return id_sondaggio

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

