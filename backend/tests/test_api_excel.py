import unittest
import base64
import os
import sys
import json
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.index import app, handle_post
from services.excel_survey_service import generate_survey_excel_template, parse_excel_base64

class DummyRequest:
    def __init__(self, body_data):
        self._body = json.dumps(body_data).encode("utf-8")
        self.headers = {}
        self.client = type("Client", (), {"host": "127.0.0.1"})()
    async def body(self):
        return self._body

class TestApiExcelEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.sample_excel_bytes = generate_survey_excel_template()
        self.sample_b64 = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64.b64encode(self.sample_excel_bytes).decode("utf-8")

    def test_get_excel_template_action(self):
        response = self.client.get("/?action=GET_EXCEL_TEMPLATE")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertTrue(data.get("fileName").endswith(".xlsx"))
        self.assertTrue(bool(data.get("fileBase64")))

        # Convalida parsing del template scaricato
        parsed = parse_excel_base64(data["fileBase64"], data["fileName"])
        self.assertTrue(parsed.get("success"))
        self.assertGreater(len(parsed["survey"]["dates"]), 0)

    @patch("api.index.verify_google_token")
    @patch("api.index.check_admin_permissions")
    @patch("api.index.get_redis_client")
    @patch("api.index.add_log")
    def test_parse_excel_survey_post(self, mock_log, mock_redis, mock_admin, mock_verify):
        mock_verify.return_value = {
            "success": True,
            "email": "admin@ohel.org",
            "userInfo": {"given_name": "Admin", "family_name": "Ohel"}
        }
        mock_admin.return_value = {
            "authorized": True,
            "socio": {"nome": "Admin", "cognome": "Ohel", "isAdmin": True}
        }
        mock_r = MagicMock()
        mock_redis.return_value = mock_r

        req = DummyRequest({
            "action": "PARSE_EXCEL_SURVEY",
            "token": "valid_admin_token",
            "payload": {
                "fileBase64": self.sample_b64,
                "fileName": "test_survey.xlsx"
            }
        })

        resp = asyncio.run(handle_post(req))
        data = json.loads(resp.body.decode("utf-8"))

        self.assertEqual(data.get("status"), "success")
        self.assertIn("survey", data)
        self.assertIn("Dicembre 2026", data["survey"]["title"])
        self.assertEqual(len(data["survey"]["dates"]), 4)

    @patch("api.index.verify_google_token")
    @patch("api.index.check_admin_permissions")
    @patch("api.index.get_redis_client")
    @patch("api.index.add_log")
    @patch("api.index.create_survey")
    def test_import_excel_survey_post(self, mock_create, mock_log, mock_redis, mock_admin, mock_verify):
        mock_verify.return_value = {
            "success": True,
            "email": "admin@ohel.org",
            "userInfo": {"given_name": "Admin", "family_name": "Ohel"}
        }
        mock_admin.return_value = {
            "authorized": True,
            "socio": {"nome": "Admin", "cognome": "Ohel", "isAdmin": True}
        }
        mock_r = MagicMock()
        mock_redis.return_value = mock_r
        mock_create.return_value = "SURV_123456789"

        req = DummyRequest({
            "action": "IMPORT_EXCEL_SURVEY",
            "token": "valid_admin_token",
            "payload": {
                "fileBase64": self.sample_b64,
                "fileName": "turni_dicembre.xlsx",
                "deactivatePrevious": False
            }
        })

        resp = asyncio.run(handle_post(req))
        data = json.loads(resp.body.decode("utf-8"))

        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("idSondaggio"), "SURV_123456789")
        self.assertTrue(mock_create.called)

if __name__ == "__main__":
    unittest.main()
