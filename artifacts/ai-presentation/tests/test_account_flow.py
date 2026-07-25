"""Regression tests for closed-beta accounts, history, and admin access."""
import os
import sys
import tempfile
import unittest
import uuid


APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, APP_DIR)

_DATA_DIR = tempfile.mkdtemp(prefix="perspeak-account-test-")
os.environ["PERSPEAK_DATA_DIR"] = _DATA_DIR
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["ADMIN_EMAIL"] = "owner@example.com"

from app import app, mvp_store  # noqa: E402


class TestAccountFlow(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()
        self.email = f"user-{uuid.uuid4()}@example.com"

    def test_product_routes_require_sign_in(self):
        self.assertEqual(self.client.get("/config").status_code, 302)
        response = self.client.get("/x/session-state")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["login"], "/login")

    def test_register_login_history_and_admin(self):
        response = self.client.post(
            "/register",
            data={"email": self.email, "password": "password123"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get("/history").status_code, 200)
        self.assertEqual(self.client.get("/admin").status_code, 403)

        self.client.post("/logout")
        response = self.client.post(
            "/login",
            data={"email": self.email, "password": "password123"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)

    def test_owner_email_is_admin(self):
        response = self.client.post(
            "/register",
            data={"email": "owner@example.com", "password": "password123"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(mvp_store.get_user_by_email("owner@example.com")["is_admin"], 1)
        self.assertEqual(self.client.get("/admin").status_code, 200)
