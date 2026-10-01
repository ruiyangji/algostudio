"""
AlgoStudio Modular Local Server & API Router
Serves frontend assets, question datasets, language server, and test execution engine.
"""

import os
import sys
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Import modular runner, lsp, and storage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from runner import execute_python_code
import lsp
import storage

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DATA_DIR = os.path.join(BASE_DIR, "sample_data")


def get_data_dir():
    """Return user data dir if populated, otherwise fallback to sample_data."""
    if os.path.exists(os.path.join(DATA_DIR, "index.json")):
        return DATA_DIR
    return SAMPLE_DATA_DIR


class AlgoStudioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Format clean compact log output safely
        try:
            msg = format % args
            sys.stderr.write(f"[{self.log_date_time_string()}] {msg}\n")
        except Exception:
            sys.stderr.write(f"[{self.log_date_time_string()}] {' '.join(str(a) for a in args)}\n")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ("/", "/index.html"):
            self.path = "/index.html"
            return super().do_GET()

        elif path == "/api/health":
            return self.send_json_response({"status": "ok", "app": "AlgoStudio", "version": "1.0.0"})

        elif path == "/api/questions":
            active_dir = get_data_dir()
            index_path = os.path.join(active_dir, "index.json")
            return self.send_json_file(index_path)

        elif path == "/api/question":
            qid = query.get("id", [""])[0]
            if not qid:
                return self.send_json_error(400, "Missing question id")

            active_dir = get_data_dir()
            q_path = os.path.join(active_dir, "questions", f"{qid}.json")
            if not os.path.exists(q_path) and active_dir != SAMPLE_DATA_DIR:
                q_path = os.path.join(SAMPLE_DATA_DIR, "questions", f"{qid}.json")

            return self.send_json_file(q_path)

        elif path == "/api/export":
            zip_bytes = storage.export_zip_archive()
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", 'attachment; filename="algostudio-problems.zip"')
            self.send_header("Content-Length", str(len(zip_bytes)))
            self.end_headers()
            self.wfile.write(zip_bytes)
            return

        # Serve static assets
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        # Handle bulk ZIP import before JSON decoding
        if path == "/api/import":
            count, imported, errors = storage.import_zip_archive(post_data)
            return self.send_json_response({
                "success": True,
                "count": count,
                "imported": imported,
                "errors": errors
            })

        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception as e:
            return self.send_json_error(400, f"Invalid JSON payload: {e}")

        if path == "/api/run":
            code = payload.get("code", "")
            test_cases = payload.get("testCases", [])
            definition = payload.get("definition") or {}
            result = execute_python_code(code, test_cases, definition)
            return self.send_json_response(result)

        elif path == "/api/complete":
            code = payload.get("code", "")
            line = payload.get("line", 1)
            column = payload.get("column", 0)
            return self.send_json_response(lsp.complete(code, line, column))

        elif path == "/api/hover":
            code = payload.get("code", "")
            line = payload.get("line", 1)
            column = payload.get("column", 0)
            return self.send_json_response(lsp.hover(code, line, column))

        elif path == "/api/lint":
            code = payload.get("code", "")
            return self.send_json_response(lsp.lint(code))

        elif path == "/api/format":
            code = payload.get("code", "")
            return self.send_json_response(lsp.format_code(code))

        elif path == "/api/questions":
            saved, errors = storage.save_question(payload)
            if errors:
                return self.send_json_error(400, ", ".join(errors))
            return self.send_json_response({"success": True, "question": saved}, status=201)

        self.send_json_error(404, "Endpoint not found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception as e:
            return self.send_json_error(400, f"Invalid JSON payload: {e}")

        if path in ("/api/questions", "/api/question"):
            qid = payload.get("id")
            if not qid:
                return self.send_json_error(400, "Missing question ID for update")
            updated, errors = storage.update_question(qid, payload)
            if errors:
                return self.send_json_error(400, ", ".join(errors))
            return self.send_json_response({"success": True, "question": updated})

        self.send_json_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ("/api/questions", "/api/question"):
            qid = query.get("id", [""])[0]
            if not qid:
                return self.send_json_error(400, "Missing question ID to delete")
            success = storage.delete_question(qid)
            if success:
                return self.send_json_response({"success": True, "deleted": qid})
            return self.send_json_error(404, f"Question '{qid}' not found")

        self.send_json_error(404, "Endpoint not found")

    def send_json_file(self, filepath):
        if not os.path.exists(filepath):
            return self.send_json_error(404, "Data file not found")

        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_json_error(500, f"Error reading file: {e}")

    def send_json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, status, message):
        self.send_json_response({"error": message, "status": status}, status=status)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="AlgoStudio Offline LeetCode Practice Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to run local server on (default: 8080)")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    args = parser.parse_args()

    server_address = (args.host, args.port)
    httpd = HTTPServer(server_address, AlgoStudioHandler)
    print("=" * 60)
    print("  AlgoStudio Offline Coding Platform")
    print(f"  Local Server: http://localhost:{args.port}")
    print("  Zero internet required. Fully self-contained.")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gracefully shut down.")
        httpd.server_close()


if __name__ == "__main__":
    main()
