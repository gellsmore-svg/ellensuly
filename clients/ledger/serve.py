#!/usr/bin/env python3
"""Serve the Ledger client and proxy /api + /health to an Ellensúly API.

Standard library only. The proxy keeps the browser same-origin, so the API's
CORS list does not need to know about this client.

    python3 serve.py                      # http://localhost:8090 -> API on :8000
    python3 serve.py --port 9000 --api http://api-host:8000
"""

from __future__ import annotations

import argparse
import os
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authorization"}


class Handler(SimpleHTTPRequestHandler):
    api: str = "http://127.0.0.1:8000"

    def _proxied(self) -> bool:
        return self.path.startswith("/api/") or self.path == "/health"

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(self.api + self.path, data=body, method=self.command)
        for key in ("Content-Type", "Accept"):
            if self.headers.get(key):
                req.add_header(key, self.headers[key])
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                status, headers, payload = res.status, res.headers, res.read()
        except urllib.error.HTTPError as err:
            status, headers, payload = err.code, err.headers, err.read()
        except urllib.error.URLError as err:
            self.send_error(502, f"Ellensúly API unreachable at {self.api}: {err.reason}")
            return
        self.send_response(status)
        for key, value in headers.items():
            if key.lower() not in HOP_BY_HOP and key.lower() != "content-length":
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        if self._proxied():
            return self._proxy()
        if self.path.split("?")[0].startswith("/test/"):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        return self._proxy() if self._proxied() else self.send_error(405)

    do_PUT = do_PATCH = do_DELETE = do_POST

    def end_headers(self) -> None:
        if not self._proxied():
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        if os.environ.get("LEDGER_QUIET"):
            return
        super().log_message(fmt, *args)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=int(os.environ.get("LEDGER_PORT", 8090)))
    parser.add_argument("--host", default=os.environ.get("LEDGER_HOST", "127.0.0.1"))
    parser.add_argument("--api", default=os.environ.get("ELLENSULY_API", "http://127.0.0.1:8000"))
    args = parser.parse_args()
    Handler.api = args.api.rstrip("/")
    server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(ROOT)))
    print(f"Ellensúly Ledger on http://{args.host}:{args.port}  (API: {Handler.api})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
