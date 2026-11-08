import json
from datetime import datetime, timezone
from typing import Dict, Any
import redis

from core.config import REDIS_PREFIX_SURVEY
from services.users_service import get_socio

def submit_presences(r: redis.Redis, email: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Salva le disponibilità/voti dei membri per un dato sondaggio.
    Replica SUBMIT_PRESENCES di GAS.
    """
    id_sondaggio = payload.get("idSondaggio", "").strip()
    if not id_sondaggio:
        return {"status": "error", "message": "ID Sondaggio mancante."}

    members_data = payload.get("membersData", {})
    if not isinstance(members_data, dict):
        return {"status": "error", "message": "membersData deve essere un dizionario."}

    clean_email = email.lower().strip()
    votes_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}:votes"
    members_to_update = [m.lower().strip() for m in members_data.keys()]

    # Rimuove le registrazioni precedenti inviate dalla stessa email o per gli stessi nominativi
    existing_votes = r.hgetall(votes_key)
    for m_name, vote_raw in existing_votes.items():
        try:
            vdata = json.loads(vote_raw)
            submitter = vdata.get("submittedByEmail", "").lower().strip()
            if submitter == clean_email or m_name.lower().strip() in members_to_update:
                r.hdel(votes_key, m_name)
        except Exception:
            pass

    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H.%M.%S")

    # Inserisce i nuovi dati
    for member_name, member_info in members_data.items():
        if not isinstance(member_info, dict):
            continue

        selections = member_info.get("selections", {})
        absences = member_info.get("absences", {})

        int_list = list(member_info.get("selectedIntolerances", []))
        custom_int = (member_info.get("customIntolerance") or "").strip()
        if custom_int and custom_int not in int_list:
            int_list.append(custom_int)

        general_notes = (member_info.get("generalNotes") or "").strip()

        member_record = {
            "memberName": member_name,
            "submittedByEmail": clean_email,
            "selections": selections,
            "absences": absences,
            "selectedIntolerances": int_list,
            "customIntolerance": "",
            "generalNotes": general_notes,
            "timestamp": now_str
        }

        r.hset(votes_key, member_name, json.dumps(member_record, ensure_ascii=False))

    return {"status": "success", "message": "Disponibilità salvate con successo!"}

def get_user_votes(r: redis.Redis, user_email: str, id_sondaggio: str) -> Dict[str, Any]:
    """
    Restituisce le disponibilità espresse da o per un utente specifico in un sondaggio.
    Gestisce anche la delega (se un altro utente ha compilato per lui).
    Replica GET_USER_VOTES di GAS.
    """
    clean_email = user_email.lower().strip() if user_email else ""
    clean_id = id_sondaggio.strip() if id_sondaggio else ""

    votes_key = f"{REDIS_PREFIX_SURVEY}{clean_id}:votes"
    data_by_member = {}

    if not clean_id:
        return {"status": "success", "dataByMember": data_by_member}

    socio = get_socio(r, clean_email)
    socio_nome_completo = f"{socio.get('nome', '')} {socio.get('cognome', '')}".lower().strip() if socio else ""

    all_votes = r.hgetall(votes_key)
    for member_name, vote_raw in all_votes.items():
        try:
            vdata = json.loads(vote_raw)
            submitter = vdata.get("submittedByEmail", "").lower().strip()
            m_name_clean = member_name.lower().strip()

            if submitter == clean_email or (socio_nome_completo and m_name_clean == socio_nome_completo):
                data_by_member[member_name] = {
                    "selections": vdata.get("selections", {}),
                    "absences": vdata.get("absences", {}),
                    "selectedIntolerances": vdata.get("selectedIntolerances", []),
                    "customIntolerance": "",
                    "generalNotes": vdata.get("generalNotes", ""),
                    "submittedByEmail": submitter
                }
        except Exception:
            pass

    # Controllo delega
    my_full_name = f"{socio.get('nome', '')} {socio.get('cognome', '')}".strip() if socio else ""
    if my_full_name and my_full_name in data_by_member:
        orig_submitter = data_by_member[my_full_name].get("submittedByEmail")
        if orig_submitter and orig_submitter != clean_email:
            single_member_data = {my_full_name: data_by_member[my_full_name]}
            submitter_socio = get_socio(r, orig_submitter)
            submitter_name = (
                f"{submitter_socio.get('nome', '')} {submitter_socio.get('cognome', '')}".strip()
                if submitter_socio
                else orig_submitter
            )

            return {
                "status": "success",
                "dataByMember": single_member_data,
                "compiledForYouBy": {
                    "isDelegated": True,
                    "name": submitter_name,
                    "email": orig_submitter
                }
            }

    return {"status": "success", "dataByMember": data_by_member}

def get_all_survey_votes(r: redis.Redis, id_sondaggio: str) -> Dict[str, Any]:
    """
    Restituisce tutte le preferenze di tutti i membri per un dato sondaggio.
    Replica GET_ALL_SURVEY_VOTES di GAS.
    """
    clean_id = id_sondaggio.strip() if id_sondaggio else ""
    votes_key = f"{REDIS_PREFIX_SURVEY}{clean_id}:votes"
    data_by_member = {}

    if not clean_id:
        return {"status": "success", "dataByMember": data_by_member}

    all_votes = r.hgetall(votes_key)
    for member_name, vote_raw in all_votes.items():
        try:
            vdata = json.loads(vote_raw)
            data_by_member[member_name] = {
                "selections": vdata.get("selections", {}),
                "absences": vdata.get("absences", {}),
                "selectedIntolerances": vdata.get("selectedIntolerances", []),
                "customIntolerance": "",
                "generalNotes": vdata.get("generalNotes", "")
            }
        except Exception:
            pass

    return {"status": "success", "dataByMember": data_by_member}

