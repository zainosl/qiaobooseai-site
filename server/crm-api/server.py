#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from socketserver import ThreadingMixIn
from urllib.parse import urlparse


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


DATA_DIR = Path(os.environ.get("CRM_DATA_DIR", "/var/lib/qiaoboose-crm"))
DATA_FILE = DATA_DIR / "customers.json"
TODO_FILE = DATA_DIR / "todo.json"
BACKUP_DIR = DATA_DIR / "backups"
TOKEN = os.environ.get("CRM_API_TOKEN", "")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def read_payload():
    if not DATA_FILE.exists():
        return {"customers": [], "updatedAt": None}
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"customers": [], "updatedAt": None}
    if isinstance(data, list):
        return {"customers": data, "updatedAt": None}
    if isinstance(data, dict):
        customers = data.get("customers")
        return {
            "customers": customers if isinstance(customers, list) else [],
            "updatedAt": data.get("updatedAt"),
        }
    return {"customers": [], "updatedAt": None}


def read_todo_payload():
    if not TODO_FILE.exists():
        return {"tasks": [], "updatedAt": None, "version": 1}
    try:
        data = json.loads(TODO_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"tasks": [], "updatedAt": None, "version": 1}
    if isinstance(data, dict):
        tasks = data.get("tasks")
        return {
            "version": data.get("version") or 1,
            "tasks": tasks if isinstance(tasks, list) else [],
            "updatedAt": data.get("updatedAt"),
        }
    return {"tasks": [], "updatedAt": None, "version": 1}


def write_payload(customers):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_FILE.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(DATA_FILE, BACKUP_DIR / f"customers-{stamp}.json")

    payload = {"customers": customers, "updatedAt": utc_now()}
    fd, tmp_name = tempfile.mkstemp(prefix="customers-", suffix=".json", dir=str(DATA_DIR))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_name, DATA_FILE)

    backups = sorted(BACKUP_DIR.glob("customers-*.json"))
    for old in backups[:-30]:
        try:
            old.unlink()
        except FileNotFoundError:
            pass
    return payload


def write_todo_payload(todo):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if TODO_FILE.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(TODO_FILE, BACKUP_DIR / f"todo-{stamp}.json")

    payload = {
        "version": todo.get("version") or 1,
        "tasks": todo["tasks"],
        "updatedAt": utc_now(),
    }
    fd, tmp_name = tempfile.mkstemp(prefix="todo-", suffix=".json", dir=str(DATA_DIR))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_name, TODO_FILE)

    backups = sorted(BACKUP_DIR.glob("todo-*.json"))
    for old in backups[:-30]:
        try:
            old.unlink()
        except FileNotFoundError:
            pass
    return payload


class Handler(BaseHTTPRequestHandler):
    server_version = "QiaobooseCRM/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "https://qiaoboose.com")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self.json_response({"ok": True, "time": utc_now()})
        if path == "/todo":
            if not self.authorized():
                return self.error_response(401, "unauthorized")
            return self.json_response(read_todo_payload())
        if path != "/customers":
            return self.error_response(404, "not found")
        if not self.authorized():
            return self.error_response(401, "unauthorized")
        return self.json_response(read_payload())

    def do_PUT(self):
        path = urlparse(self.path).path
        if not self.authorized():
            return self.error_response(401, "unauthorized")
        if path == "/todo":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                body = json.loads(raw.decode("utf-8"))
                tasks = body.get("tasks")
                if not isinstance(tasks, list):
                    raise ValueError("tasks must be a list")
                payload = write_todo_payload(body)
            except Exception as exc:
                return self.error_response(400, str(exc))
            return self.json_response({"ok": True, "count": len(payload["tasks"]), "updatedAt": payload["updatedAt"]})
        if path != "/customers":
            return self.error_response(404, "not found")
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8"))
            customers = body.get("customers")
            if not isinstance(customers, list):
                raise ValueError("customers must be a list")
            payload = write_payload(customers)
        except Exception as exc:
            return self.error_response(400, str(exc))
        return self.json_response({"ok": True, "count": len(payload["customers"]), "updatedAt": payload["updatedAt"]})

    def authorized(self):
        if not TOKEN:
            return False
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {TOKEN}"

    def json_response(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error_response(self, status, message):
        return self.json_response({"ok": False, "error": message}, status)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


def main():
    host = os.environ.get("CRM_API_HOST", "127.0.0.1")
    port = int(os.environ.get("CRM_API_PORT", "8790"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
