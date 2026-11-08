import sys
import os
import json
import asyncio
import unittest
from unittest.mock import patch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from tests.test_services import MockRedis
import api.index as api_module
from core.config import ADMIN_PASSWORD
from services.users_service import salva_nuovo_socio, get_socio
from services.surveys_service import create_survey
from services.votes_service import submit_presences


class DummyRequest:
    def __init__(self, method="GET", query_params=None, body_data=None, headers=None):
        self.method = method
        self.query_params = query_params or {}
        self.headers = headers or {}
        self._body = json.dumps(body_data).encode("utf-8") if body_data is not None else b""

    async def body(self):
        return self._body

    async def json(self):
        return json.loads(self._body.decode("utf-8")) if self._body else {}


# Add setex to MockRedis if missing
if not hasattr(MockRedis, "setex"):
    def setex(self, key, time, value):
        self.strings[key] = str(value)
        return True
    MockRedis.setex = setex

if not hasattr(MockRedis, "exists"):
    def exists(self, key):
        return key in self.strings or key in self.hashes or key in self.sets or key in self.zsets
    MockRedis.exists = exists


class TestAdminPanel(unittest.TestCase):
    def setUp(self):
        self.r = MockRedis()
        self.patcher_redis = patch.object(api_module, "get_redis_client", return_value=self.r)
        self.mock_redis_client = self.patcher_redis.start()

    def tearDown(self):
        self.patcher_redis.stop()

    def test_serve_admin_html(self):
        resp = asyncio.run(api_module.serve_admin_panel())
        self.assertIn("OhelCMS Admin Portal", resp.body.decode("utf-8"))
        self.assertEqual(resp.status_code, 200)

    def test_admin_auth_and_dashboard(self):
        # 1. Login con password errata
        req_wrong = DummyRequest(method="POST", body_data={"password": "wrong_password"})
        resp_wrong = asyncio.run(api_module.admin_login(req_wrong))
        self.assertEqual(resp_wrong.status_code, 401)

        # 2. Login con password corretta
        req_ok = DummyRequest(method="POST", body_data={"password": ADMIN_PASSWORD})
        resp_ok = asyncio.run(api_module.admin_login(req_ok))
        self.assertEqual(resp_ok.status_code, 200)
        data = json.loads(resp_ok.body.decode("utf-8"))
        token = data["token"]
        self.assertTrue(len(token) > 10)

        # 3. Registra un utente di test
        salva_nuovo_socio(self.r, {
            "idGoogle": "123",
            "nome": "Giuseppe",
            "cognome": "Verdi",
            "email": "giuseppe@example.com",
            "picture": "pic.jpg"
        })

        # 4. Accesso alla dashboard con token
        req_dash = DummyRequest(method="GET", headers={"Authorization": f"Bearer {token}"})
        resp_dash = asyncio.run(api_module.admin_dashboard(req_dash))
        self.assertEqual(resp_dash.status_code, 200)
        dash_data = json.loads(resp_dash.body.decode("utf-8"))
        self.assertEqual(dash_data["stats"]["totalUsers"], 1)
        self.assertEqual(dash_data["stats"]["adminUsers"], 0)

        # 5. Battezza l'utente come Admin del CMS!
        req_toggle = DummyRequest(
            method="POST",
            headers={"Authorization": f"Bearer {token}"},
            body_data={"email": "giuseppe@example.com", "isAdmin": True}
        )
        resp_toggle = asyncio.run(api_module.admin_toggle_user_admin(req_toggle))
        self.assertEqual(resp_toggle.status_code, 200)
        t_data = json.loads(resp_toggle.body.decode("utf-8"))
        self.assertEqual(t_data["status"], "success")

        # Verifica che nel DB sia ora un admin
        socio = get_socio(self.r, "giuseppe@example.com")
        self.assertTrue(socio["isAdmin"])

        # 6. Revoca permessi admin
        req_revoke = DummyRequest(
            method="POST",
            headers={"Authorization": f"Bearer {token}"},
            body_data={"email": "giuseppe@example.com", "isAdmin": False}
        )
        resp_revoke = asyncio.run(api_module.admin_toggle_user_admin(req_revoke))
        self.assertEqual(resp_revoke.status_code, 200)
        socio_revoked = get_socio(self.r, "giuseppe@example.com")
        self.assertFalse(socio_revoked["isAdmin"])

        # 7. Logout
        req_logout = DummyRequest(method="POST", headers={"Authorization": f"Bearer {token}"})
        resp_logout = asyncio.run(api_module.admin_logout(req_logout))
        self.assertEqual(resp_logout.status_code, 200)

        # Tentativo dashboard dopo logout deve fallire
        resp_dash_after = asyncio.run(api_module.admin_dashboard(req_dash))
        self.assertEqual(resp_dash_after.status_code, 401)


if __name__ == "__main__":
    unittest.main()

