"""
Unit Test per la logica di business di OhelCMS (Mocking Redis)
==============================================================
Testa l'intero flusso di:
- Gestione utenti (login, registrazione, admin)
- Creazione e gestione sondaggi
- Invio disponibilità e deleghe
- Replicazione 1:1 della logica Google Apps Script
"""

import sys
import os
import json
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.users_service import get_socio, salva_nuovo_socio, check_admin_permissions
from services.surveys_service import (
    create_survey,
    get_active_surveys,
    get_all_surveys,
    toggle_survey_status,
    delete_survey
)
from services.votes_service import submit_presences, get_user_votes, get_all_survey_votes


class MockRedis:
    def __init__(self):
        self.strings = {}
        self.hashes = {}
        self.sets = {}
        self.zsets = {}  # key -> dict(member -> score)

    def set(self, key, value):
        self.strings[key] = str(value)
        return True

    def get(self, key):
        return self.strings.get(key)

    def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self.strings:
                del self.strings[k]
                count += 1
            if k in self.hashes:
                del self.hashes[k]
                count += 1
            if k in self.sets:
                del self.sets[k]
                count += 1
            if k in self.zsets:
                del self.zsets[k]
                count += 1
        return count

    def hset(self, key, field=None, value=None, mapping=None, **kwargs):
        if key not in self.hashes:
            self.hashes[key] = {}
        if field is not None and value is not None:
            self.hashes[key][field] = str(value)
        if mapping:
            for k, v in mapping.items():
                self.hashes[key][k] = str(v)
        if kwargs:
            for k, v in kwargs.items():
                self.hashes[key][k] = str(v)
        return True

    def hget(self, key, field):
        return self.hashes.get(key, {}).get(field)

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def hdel(self, key, *fields):
        count = 0
        h = self.hashes.get(key, {})
        for f in fields:
            if f in h:
                del h[f]
                count += 1
        return count

    def hlen(self, key):
        return len(self.hashes.get(key, {}))

    def sadd(self, key, *members):
        if key not in self.sets:
            self.sets[key] = set()
        for m in members:
            self.sets[key].add(m)
        return len(members)

    def smembers(self, key):
        return set(self.sets.get(key, set()))

    def srem(self, key, *members):
        s = self.sets.get(key, set())
        for m in members:
            s.discard(m)

    def zadd(self, key, mapping):
        if key not in self.zsets:
            self.zsets[key] = {}
        for m, score in mapping.items():
            self.zsets[key][m] = score
        return len(mapping)

    def zrange(self, key, start, stop):
        z = self.zsets.get(key, {})
        sorted_members = sorted(z.keys(), key=lambda m: z[m])
        if stop == -1:
            return sorted_members[start:]
        return sorted_members[start:stop + 1]

    def zrem(self, key, *members):
        z = self.zsets.get(key, {})
        for m in members:
            if m in z:
                del z[m]


class TestOhelBackend(unittest.TestCase):
    def setUp(self):
        self.r = MockRedis()

    def test_user_flow(self):
        # 1. Registrazione nuovo socio normale
        payload = {
            "idGoogle": "123456",
            "nome": "Mario",
            "cognome": "Rossi",
            "email": "mario.rossi@example.com",
            "picture": "https://example.com/pic.jpg"
        }
        salva_nuovo_socio(self.r, payload)

        socio = get_socio(self.r, "mario.rossi@example.com")
        self.assertIsNotNone(socio)
        self.assertEqual(socio["nome"], "Mario")
        self.assertEqual(socio["cognome"], "Rossi")
        self.assertFalse(socio["isAdmin"])

        # Controllo permessi admin (deve fallire)
        auth = check_admin_permissions(self.r, "mario.rossi@example.com")
        self.assertFalse(auth["authorized"])

        # 2. Crea admin
        admin_payload = {
            "idGoogle": "999999",
            "nome": "Simone",
            "cognome": "Cantore",
            "email": "admin@example.com",
            "picture": "https://example.com/admin.jpg"
        }
        salva_nuovo_socio(self.r, admin_payload)
        # Promuovi a admin
        self.r.hset("ohel:user:admin@example.com", mapping={"isAdmin": "true"})

        admin_socio = get_socio(self.r, "admin@example.com")
        self.assertTrue(admin_socio["isAdmin"])
        auth_admin = check_admin_permissions(self.r, "admin@example.com")
        self.assertTrue(auth_admin["authorized"])

    def test_surveys_and_votes(self):
        # 1. Crea sondaggio
        survey_payload = {
            "title": "Soggiorno Estivo 2026",
            "description": "Indica le tue preferenze",
            "dates": [
                {
                    "date": "2026-07-20",
                    "timeRange": {"start": "09:00", "end": "18:00"},
                    "subtitle": "Primo Giorno",
                    "timeSlots": ["Mattina", "Pomeriggio"],
                    "notes": "Arrivo con mezzi propri"
                },
                {
                    "date": "2026-07-21",
                    "timeRange": {"start": "08:00", "end": "20:00"},
                    "subtitle": "Secondo Giorno",
                    "timeSlots": ["Mattina", "Pomeriggio", "Sera"],
                    "notes": ""
                }
            ]
        }
        surv_id = create_survey(self.r, survey_payload)
        self.assertTrue(surv_id.startswith("SURV_"))

        # Recupera tutti i sondaggi
        all_s = get_all_surveys(self.r)
        self.assertEqual(len(all_s), 1)
        self.assertEqual(all_s[0]["idSondaggio"], surv_id)
        self.assertEqual(all_s[0]["status"], "ATTIVO")

        # Recupera attivi prima del voto
        active_s = get_active_surveys(self.r, "mario.rossi@example.com")
        self.assertEqual(len(active_s), 1)
        self.assertFalse(active_s[0]["voted"])

        # 2. Registra soci per il test di delega
        salva_nuovo_socio(self.r, {
            "idGoogle": "1", "nome": "Mario", "cognome": "Rossi",
            "email": "mario.rossi@example.com", "picture": ""
        })
        salva_nuovo_socio(self.r, {
            "idGoogle": "2", "nome": "Luigi", "cognome": "Rossi",
            "email": "luigi.rossi@example.com", "picture": ""
        })

        # Mario vota per sé e per Luigi (delega familiare)
        votes_payload = {
            "idSondaggio": surv_id,
            "membersData": {
                "Mario Rossi": {
                    "selections": {"2026-07-20": ["Mattina"]},
                    "absences": {"2026-07-20": False, "2026-07-21": True},
                    "selectedIntolerances": ["Glutine"],
                    "customIntolerance": "No crostacei",
                    "generalNotes": "Nota Mario"
                },
                "Luigi Rossi": {
                    "selections": {"2026-07-20": ["Mattina", "Pomeriggio"]},
                    "absences": {"2026-07-20": False},
                    "selectedIntolerances": ["Lattosio"],
                    "customIntolerance": "",
                    "generalNotes": "Nota Luigi"
                }
            }
        }
        res_submit = submit_presences(self.r, "mario.rossi@example.com", votes_payload)
        self.assertEqual(res_submit["status"], "success")

        # Ora controlla che per Mario il sondaggio risulti 'voted: True'
        active_mario = get_active_surveys(self.r, "mario.rossi@example.com")
        self.assertTrue(active_mario[0]["voted"])

        # E per Luigi (che non ha votato direttamente, ma per cui Mario ha compilato):
        active_luigi = get_active_surveys(self.r, "luigi.rossi@example.com")
        self.assertTrue(active_luigi[0]["voted"])

        # 3. GET_USER_VOTES per Mario (titolare del voto)
        mario_votes = get_user_votes(self.r, "mario.rossi@example.com", surv_id)
        self.assertEqual(mario_votes["status"], "success")
        self.assertIn("Mario Rossi", mario_votes["dataByMember"])
        self.assertIn("Luigi Rossi", mario_votes["dataByMember"])
        # Intolleranze custom incluse
        self.assertIn("No crostacei", mario_votes["dataByMember"]["Mario Rossi"]["selectedIntolerances"])
        self.assertNotIn("compiledForYouBy", mario_votes)

        # 4. GET_USER_VOTES per Luigi (delega rilevata!)
        luigi_votes = get_user_votes(self.r, "luigi.rossi@example.com", surv_id)
        self.assertEqual(luigi_votes["status"], "success")
        self.assertIn("compiledForYouBy", luigi_votes)
        self.assertTrue(luigi_votes["compiledForYouBy"]["isDelegated"])
        self.assertEqual(luigi_votes["compiledForYouBy"]["email"], "mario.rossi@example.com")
        self.assertEqual(luigi_votes["compiledForYouBy"]["name"], "Mario Rossi")

        # 5. GET_ALL_SURVEY_VOTES
        all_votes = get_all_survey_votes(self.r, surv_id)
        self.assertEqual(len(all_votes["dataByMember"]), 2)

        # 6. TOGGLE_SURVEY_STATUS
        toggle_res = toggle_survey_status(self.r, surv_id, "DISATTIVATO")
        self.assertEqual(toggle_res["newStatus"], "DISATTIVATO")
        # Attivi ora deve essere vuoto
        self.assertEqual(len(get_active_surveys(self.r)), 0)
        # Tutti deve ancora contenerlo
        self.assertEqual(len(get_all_surveys(self.r)), 1)

        # 7. DELETE_SURVEY
        del_res = delete_survey(self.r, surv_id)
        self.assertEqual(del_res["status"], "success")
        self.assertEqual(len(get_all_surveys(self.r)), 0)


if __name__ == "__main__":
    unittest.main()
