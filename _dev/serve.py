#!/usr/bin/env python3
"""Local dev server that disables caching.

Browsers (especially iOS Safari) aggressively cache HTML/JS/CSS without
explicit headers. This server sends no-store on every response so dev
changes appear immediately on a refresh.

Usage:
  python3 mm/_dev/serve.py [port] [directory]
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    os.chdir(directory)
    print(f'Serving {directory!r} on http://0.0.0.0:{port}/ (no-cache)', flush=True)
    HTTPServer(('0.0.0.0', port), NoCacheHandler).serve_forever()
