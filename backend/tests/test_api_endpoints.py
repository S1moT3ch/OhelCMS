import sys
import os
import json
import asyncio
import unittest
from unittest.mock import patch, MagicMock

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from tests.test_services import MockRedis
import api.index as api_module


class DummyRequest:
    def __init__(self, method="GET", query_params=None, body_data=None):
        self.method = method
        self.query_params = query_params or {}
        self._body = json.dumps(body_data).encode("utf-8") if body_data else b""

    async def body(self):
        return self._body


class TestApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.r = MockRedis()
        self.patcher_redis = patch.object(api_module, "get_redis_client", return_value=self.r)
        self.mock_redis_client = self.patcher_redis.start()

    def tearDown(self):
        self.patcher_redis.stop()

    def test_get_endpoints(self):
        # 1. Health check (no action)
        req = DummyRequest(query_params={})
        resp = asyncio.run(api_module.handle_get(req))
        data = json.loads(resp.body.decode("utf-8"))
        self.assertEqual(data["status"], "ok")

        # 2. GET_ALL_SURVEYS (empty initially)
        req = DummyRequest(query_params={"action": "GET_ALL_SURVEYS"})
        resp = asyncio.run(api_module.handle_get(req))
        data = json.loads(resp.body.decode("utf-8"))
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["surveys"], [])

    @patch.object(api_module, "verify_google_token")
    def test_post_endpoints(self, mock_verify):
        # Mock Google Token Verification
        mock_verify.return_value = {
            "success": True,
            "email": "mario@example.com",
            "userInfo": {
                "sub": "123",
                "given_name": "Mario",
                "family_name": "Rossi",
                "picture": "pic.jpg"
            }
        }

        # 1. LOGIN quando non esiste
        login_req = DummyRequest(
            method="POST",
            body_data={"action": "LOGIN", "token": "dummy_token"}
        )
        resp = asyncio.run(api_module.handle_post(login_req))
        data = json.loads(resp.body.decode("utf-8"))
        self.assertEqual(data["status"], "success")
        self.assertFalse(data["exists"])
        self.assertEqual(data["googleData"]["email"], "mario@example.com")

        # 2. REGISTER
        reg_req = DummyRequest(
            method="POST",
            body_data={
                "action": "REGISTER",
                "token": "dummy_token",
                "payload": {
                    "idGoogle": "123",
                    "nome": "Mario",
                    "cognome": "Rossi",
                    "email": "mario@example.com",
                    "picture": "pic.jpg"
                }
            }
        )
        resp = asyncio.run(api_module.handle_post(reg_req))
        data = json.loads(resp.body.decode("utf-8"))
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["message"], "Registrazione completata")

        # 3. LOGIN dopo registrazione
        resp = asyncio.run(api_module.handle_post(login_req))
        data = json.loads(resp.body.decode("utf-8"))
        self.assertEqual(data["status"], "success")
        self.assertTrue(data["exists"])
        self.assertEqual(data["user"]["email"], "mario@example.com")


if __name__ == "__main__":
    unittest.main()

