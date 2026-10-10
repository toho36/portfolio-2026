"""Owned compiled study preview. Port 5186; no cache or SPA fallback tricks."""
import sys
from functools import partial
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
root=sys.argv[1] if len(sys.argv)>1 else str(Path.home()/'.hermes/cache/scratch/light-table-build')
ThreadingHTTPServer(('127.0.0.1',5186),partial(Handler,directory=root)).serve_forever()
