"""Vercel serverless entrypoint — exposes the PerspeakAI Flask app as WSGI.

All routes are rewritten here via vercel.json. The Flask app lives in
artifacts/ai-presentation/ (kept there so the Replit layout still works).
"""
import os
import sys

_APP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "artifacts", "ai-presentation",
)
sys.path.insert(0, _APP_DIR)

from app import app  # noqa: E402,F401  (Vercel looks for the `app` WSGI object)
