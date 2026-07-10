"""
server_store.py — serverless-safe persistence layer for PerspeakAI.

Two jobs:
1. Store: byte blobs (uploaded decks, slide JSON, reports) written to a local
   dir AND — when BLOB_READ_WRITE_TOKEN is set (Vercel) — mirrored to Vercel
   Blob so any serverless instance can read them. Local dir acts as a
   per-instance cache.
2. StoreSessionInterface: replaces Flask's 4KB cookie session with a
   server-side session (full dict lives in the Store, cookie holds only a
   UUID). Kills the whole "cookie > 4093 bytes → browser drops it → state
   silently rolls back" bug class.

Vercel Blob REST protocol matches @vercel/blob v2.6 (x-api-version: 12).
"""
import hashlib
import hmac
import json
import os
import time
import uuid

import requests
from flask.sessions import SessionInterface, SessionMixin
from werkzeug.datastructures import CallbackDict

_BLOB_API = os.environ.get("VERCEL_BLOB_API_URL", "https://vercel.com/api/blob")
_BLOB_API_VERSION = "12"
_BLOB_PREFIX = "perspeak"  # namespace inside the blob store


def _on_vercel() -> bool:
    return os.environ.get("VERCEL") == "1"


def local_data_dir() -> str:
    """Writable dir: uploads/ next to app.py in dev, /tmp on Vercel."""
    if os.environ.get("PERSPEAK_DATA_DIR"):
        return os.environ["PERSPEAK_DATA_DIR"]
    if _on_vercel():
        return "/tmp/perspeak"
    return os.path.join(os.path.dirname(__file__), "uploads")


class Store:
    def __init__(self):
        self.token = os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip()
        self._base_url = None  # public store base, discovered on first PUT

    @property
    def blob_enabled(self) -> bool:
        return bool(self.token)

    # ── local cache ──────────────────────────────────────────────────────────
    def _local_path(self, path: str) -> str:
        full = os.path.join(local_data_dir(), path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        return full

    # ── Vercel Blob REST ─────────────────────────────────────────────────────
    def _blob_put(self, path: str, data: bytes) -> str:
        # pathname goes in the query string, not the URL path (matches
        # @vercel/blob's requestApi: PUT {api}/?pathname=<encoded>)
        pathname = requests.utils.quote(f"{_BLOB_PREFIX}/{path}", safe="")
        resp = requests.put(
            f"{_BLOB_API}/?pathname={pathname}",
            data=data,
            headers={
                "authorization": f"Bearer {self.token}",
                "x-api-version": _BLOB_API_VERSION,
                "x-allow-overwrite": "1",
                "x-add-random-suffix": "0",
                "x-content-type": "application/octet-stream",
            },
            timeout=30,
        )
        resp.raise_for_status()
        url = resp.json()["url"]
        # cache the store's public base URL so other paths can be read back
        suffix = f"/{_BLOB_PREFIX}/{path}"
        if url.endswith(suffix):
            self._base_url = url[: -len(suffix)]
        return url

    def _blob_base(self) -> str | None:
        if self._base_url:
            return self._base_url
        try:  # tiny marker PUT teaches us the store's public URL
            self._blob_put("_init", b"1")
        except Exception:
            return None
        return self._base_url

    def _blob_get(self, path: str) -> bytes | None:
        base = self._blob_base()
        if not base:
            return None
        try:
            resp = requests.get(f"{base}/{_BLOB_PREFIX}/{path}", timeout=30)
            if resp.status_code == 200:
                return resp.content
        except Exception:
            pass
        return None

    # ── public API ───────────────────────────────────────────────────────────
    def put(self, path: str, data: bytes) -> None:
        with open(self._local_path(path), "wb") as fh:
            fh.write(data)
        if self.blob_enabled:
            self._blob_put(path, data)

    def get(self, path: str) -> bytes | None:
        local = self._local_path(path)
        if os.path.exists(local):
            with open(local, "rb") as fh:
                return fh.read()
        if self.blob_enabled:
            data = self._blob_get(path)
            if data is not None:
                with open(local, "wb") as fh:
                    fh.write(data)
            return data
        return None

    def put_json(self, path: str, obj) -> None:
        self.put(path, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def get_json(self, path: str, default=None):
        raw = self.get(path)
        if raw is None:
            return default
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return default

    def ensure_local_file(self, path: str) -> str | None:
        """Return a local filesystem path for `path`, pulling from Blob if
        this instance has never seen it. None if nowhere to be found."""
        local = self._local_path(path)
        if os.path.exists(local):
            return local
        data = self.get(path)
        return local if data is not None else None

    # ── client-upload token (browser → Vercel Blob direct PUT) ──────────────
    def client_upload_token(self, pathname: str, valid_seconds: int = 900,
                            max_bytes: int = 50 * 1024 * 1024) -> str | None:
        """Port of @vercel/blob generateClientTokenFromReadWriteToken.
        Lets the browser PUT big files straight to Blob, dodging Vercel's
        4.5MB request-body cap on serverless functions."""
        if not self.blob_enabled:
            return None
        parts = self.token.split("_")
        if len(parts) < 5:  # vercel_blob_rw_<storeId>_<secret>
            return None
        store_id = parts[3]
        payload_json = json.dumps({
            "pathname": f"{_BLOB_PREFIX}/{pathname}",
            "validUntil": int((time.time() + valid_seconds) * 1000),
            "addRandomSuffix": False,
            "allowOverwrite": True,
            "maximumSizeInBytes": max_bytes,
        }, separators=(",", ":"))
        import base64 as _b64
        payload_b64 = _b64.b64encode(payload_json.encode()).decode()
        secured = hmac.new(self.token.encode(), payload_b64.encode(),
                           hashlib.sha256).hexdigest()
        return ("vercel_blob_client_" + store_id + "_"
                + _b64.b64encode(f"{secured}.{payload_b64}".encode()).decode())

    def blob_pathname_from_url(self, url: str) -> str | None:
        """Validate a client-reported blob URL belongs to OUR store and
        namespace; return the store-relative path (without prefix)."""
        base = self._blob_base()
        if not base or not url.startswith(f"{base}/{_BLOB_PREFIX}/"):
            return None
        return url[len(f"{base}/{_BLOB_PREFIX}/"):]


store = Store()


# ── Server-side Flask session ─────────────────────────────────────────────────
class ServerSession(CallbackDict, SessionMixin):
    def __init__(self, initial=None, sid=None, new=False):
        def on_update(_):
            self.modified = True
        super().__init__(initial, on_update)
        self.sid = sid
        self.new = new
        self.modified = False


class StoreSessionInterface(SessionInterface):
    COOKIE_NAME = "psid"

    def _path(self, sid: str) -> str:
        return f"sessions/{sid}.json"

    def open_session(self, app, request):
        sid = request.cookies.get(self.COOKIE_NAME, "")
        try:
            uuid.UUID(sid)
        except ValueError:
            return ServerSession(sid=str(uuid.uuid4()), new=True)
        data = store.get_json(self._path(sid))
        if data is None:
            return ServerSession(sid=sid, new=True)
        return ServerSession(data, sid=sid)

    def save_session(self, app, session, response):
        if not session.modified and not session.new:
            return
        try:
            store.put_json(self._path(session.sid), dict(session))
        except Exception as e:
            app.logger.error(f"[Session] save failed: {e}")
        response.set_cookie(
            self.COOKIE_NAME, session.sid,
            httponly=True, samesite="Lax",
            secure=self.get_cookie_secure(app),
            path="/", max_age=60 * 60 * 24 * 7,
        )
