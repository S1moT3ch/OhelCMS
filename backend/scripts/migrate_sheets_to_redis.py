"""
Script di Migrazione: da Google Sheets a Redis Database per OhelCMS
===================================================================
Questo script legge i dati dai due fogli Google Sheets storici:
1. File Registrazioni (Tab 'Registrazioni')
2. File Sondaggi (Tab 'Configurazione_Sondaggi' e 'Risposte_Presenze')

E li migra all'interno della nuova struttura del database Redis.

Utilizzo:
    python scripts/migrate_sheets_to_redis.py
    oppure
    python scripts/migrate_sheets_to_redis.py --redis-url "rediss://default:xxxx@xxxx.upstash.io:6379"
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any

# Aggiungi root del backend a sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import redis
from core.config import (
    REDIS_URL,
    GOOGLE_SHEETS_API_KEY,
    ID_FILE_SONDAGGI,
    ID_FILE_REGISTRAZIONI,
    REDIS_PREFIX_USER,
    REDIS_KEY_USERS,
    REDIS_PREFIX_SURVEY,
    REDIS_KEY_SURVEYS,
)


def fetch_sheet_values(sheet_id: str, range_name: str, api_key: str) -> List[List[Any]]:
    """Esegue una chiamata alla Google Sheets API v4 per estrarre le righe."""
    encoded_range = urllib.parse.quote(range_name)
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{encoded_range}?key={api_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "OhelCMS-Migrator/1.0"})
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("values", [])


def clean_header(header_row: List[str]) -> List[str]:
    """Pulisce gli header rimuovendo spazi e caratteri speciali."""
    return [h.lower().replace(" ", "").replace("_", "") for h in header_row]


def migrate_users(r: redis.Redis, api_key: str, sheet_id: str) -> int:
    """Migra i soci dal foglio 'Registrazioni' a Redis."""
    print("\n[1/3] 👥 Migrazione Soci / Registrazioni...")
    rows = fetch_sheet_values(sheet_id, "Registrazioni!A1:Z1000", api_key)
    if len(rows) <= 1:
        print("   Nessun dato utente trovato.")
        return 0

    headers = clean_header(rows[0])
    count = 0

    for row in rows[1:]:
        row_dict = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
        email = row_dict.get("email", "").lower().strip()
        if not email:
            continue

        id_google = row_dict.get("idgoogle", "")
        nome = row_dict.get("nome", "")
        cognome = row_dict.get("cognome", "")
        picture = row_dict.get("urlfotoprofilo", "").replace(" ", "")
        timestamp = row_dict.get("timestampregistrazione", "")
        is_admin_str = str(row_dict.get("admin", "")).strip().lower()
        is_admin = "true" if is_admin_str in ("true", "1") else "false"

        user_key = f"{REDIS_PREFIX_USER}{email}"
        user_data = {
            "idGoogle": id_google,
            "nome": nome,
            "cognome": cognome,
            "email": email,
            "picture": picture,
            "dataRegistrazione": timestamp or datetime.now(timezone.utc).strftime("%d/%m/%Y %H.%M.%S"),
            "isAdmin": is_admin
        }

        r.hset(user_key, mapping=user_data)
        r.sadd(REDIS_KEY_USERS, email)
        count += 1
        print(f"   -> Socio salvato: {nome} {cognome} ({email}) - Admin: {is_admin}")

    return count


def migrate_surveys(r: redis.Redis, api_key: str, sheet_id: str) -> int:
    """Migra i sondaggi e le loro date dal foglio 'Configurazione_Sondaggi' a Redis."""
    print("\n[2/3] 📋 Migrazione Configurazione Sondaggi...")
    rows = fetch_sheet_values(sheet_id, "Configurazione_Sondaggi!A1:Z1000", api_key)
    if len(rows) <= 1:
        print("   Nessun sondaggio trovato.")
        return 0

    headers = clean_header(rows[0])
    surveys_map: Dict[str, Dict[str, Any]] = {}

    for row in rows[1:]:
        row_dict = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
        id_sondaggio = row_dict.get("idsondaggio", "").strip()
        if not id_sondaggio:
            continue

        if id_sondaggio not in surveys_map:
            surveys_map[id_sondaggio] = {
                "idSondaggio": id_sondaggio,
                "title": row_dict.get("titolo", ""),
                "description": row_dict.get("descrizione", ""),
                "status": row_dict.get("stato", "ATTIVO"),
                "dates": []
            }

        fasce_raw = row_dict.get("fasceorarie", "")
        time_slots = [s.strip() for s in fasce_raw.split(",") if s.strip()] if fasce_raw else []

        date_entry = {
            "date": row_dict.get("dataattivita", ""),
            "timeRange": {
                "start": row_dict.get("orarioinizio", ""),
                "end": row_dict.get("orariofine", "")
            },
            "subtitle": row_dict.get("sottotitolo", ""),
            "timeSlots": time_slots,
            "notes": row_dict.get("notespecifiche", "")
        }
        surveys_map[id_sondaggio]["dates"].append(date_entry)

    count = 0
    base_time = 1700000000.0  # Timestamp base per ordinamento cronologico

    for id_sondaggio, surv in surveys_map.items():
        # Cerca di estrarre timestamp numerico da SURV_123456789
        score = base_time + count
        try:
            if "_" in id_sondaggio:
                score = float(id_sondaggio.split("_")[1]) / 1000.0
        except Exception:
            pass

        survey_key = f"{REDIS_PREFIX_SURVEY}{id_sondaggio}"
        r.set(survey_key, json.dumps(surv, ensure_ascii=False))
        r.zadd(REDIS_KEY_SURVEYS, {id_sondaggio: score})
        count += 1
        print(f"   -> Sondaggio salvato: {surv['title']} [{id_sondaggio}] - Stato: {surv['status']} ({len(surv['dates'])} date)")

    return count


def migrate_votes(r: redis.Redis, api_key: str, sheet_id: str) -> int:
    """Migra le disponibilità espresse dai membri dal foglio 'Risposte_Presenze' a Redis."""
    print("\n[3/3] 🗳️ Migrazione Risposte Presenze / Voti...")
    rows = fetch_sheet_values(sheet_id, "Risposte_Presenze!A1:Z2000", api_key)
    if len(rows) <= 1:
        print("   Nessun voto trovato.")
        return 0

    headers = clean_header(rows[0])
    votes_by_survey: Dict[str, Dict[str, Dict[str, Any]]] = {}

    for row in rows[1:]:
        row_dict = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
        surv_id = row_dict.get("idsondaggio", "").strip()
        member_name = row_dict.get("nomeutente", "").strip()
        if not surv_id or not member_name:
            continue

        if surv_id not in votes_by_survey:
            votes_by_survey[surv_id] = {}

        if member_name not in votes_by_survey[surv_id]:
            votes_by_survey[surv_id][member_name] = {
                "memberName": member_name,
                "submittedByEmail": row_dict.get("emailutente", "").lower().strip(),
                "selections": {},
                "absences": {},
                "selectedIntolerances": [],
                "customIntolerance": "",
                "generalNotes": row_dict.get("noteutente", "").strip(),
                "timestamp": row_dict.get("timestamp", "")
            }

        m_vote = votes_by_survey[surv_id][member_name]
        date_str = row_dict.get("dataattivita", "").strip()
        fascia = row_dict.get("fasciaselezionata", "").strip()

        if date_str:
            if fascia == "ASSENTE":
                m_vote["absences"][date_str] = True
                m_vote["selections"][date_str] = []
            elif fascia:
                if date_str not in m_vote["selections"]:
                    m_vote["selections"][date_str] = []
                if fascia not in m_vote["selections"][date_str]:
                    m_vote["selections"][date_str].append(fascia)
                m_vote["absences"][date_str] = False

        profilo = row_dict.get("profiloalimentare", "").strip()
        if profilo and not m_vote["selectedIntolerances"]:
            m_vote["selectedIntolerances"] = [s.strip() for s in profilo.split(",") if s.strip()]

        note_utente = row_dict.get("noteutente", "").strip()
        if note_utente and not m_vote["generalNotes"]:
            m_vote["generalNotes"] = note_utente

    total_votes_saved = 0
    for surv_id, members in votes_by_survey.items():
        votes_key = f"{REDIS_PREFIX_SURVEY}{surv_id}:votes"
        for member_name, vote_record in members.items():
            r.hset(votes_key, member_name, json.dumps(vote_record, ensure_ascii=False))
            total_votes_saved += 1
        print(f"   -> Risposte salvate per {surv_id}: {len(members)} partecipanti.")

    return total_votes_saved


def main():
    parser = argparse.ArgumentParser(description="Migra i dati di OhelCMS da Google Sheets a Redis.")
    parser.add_argument("--redis-url", default=REDIS_URL, help="URL di connessione Redis")
    parser.add_argument("--api-key", default=GOOGLE_SHEETS_API_KEY, help="Google Sheets API Key")
    parser.add_argument("--id-sondaggi", default=ID_FILE_SONDAGGI, help="ID Foglio Google Sondaggi")
    parser.add_argument("--id-registrazioni", default=ID_FILE_REGISTRAZIONI, help="ID Foglio Google Registrazioni")
    args = parser.parse_args()

    print("==================================================")
    print("🚀 AVVIO MIGRAZIONE OhelCMS: Google Sheets -> Redis")
    print("==================================================")
    print(f"Redis Target: {args.redis_url}")

    try:
        r = redis.Redis.from_url(
            args.redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5
        )
        r.ping()
        print("✅ Connessione a Redis riuscita!")
    except Exception as e:
        print(f"❌ Impossibile connettersi a Redis: {e}")
        print("Verifica che il server Redis sia attivo o imposta REDIS_URL corretto.")
        sys.exit(1)

    users_count = migrate_users(r, args.api_key, args.id_registrazioni)
    surveys_count = migrate_surveys(r, args.api_key, args.id_sondaggi)
    votes_count = migrate_votes(r, args.api_key, args.id_sondaggi)

    print("\n==================================================")
    print("🎉 MIGRAZIONE COMPLETATA CON SUCCESSO!")
    print(f" - Soci / Utenti migrati: {users_count}")
    print(f" - Sondaggi migrati:      {surveys_count}")
    print(f" - Schede Voto migrate:   {votes_count}")
    print("==================================================")


if __name__ == "__main__":
    main()

