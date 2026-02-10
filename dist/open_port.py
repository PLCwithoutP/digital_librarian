import os
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DIST_DIR = os.path.dirname(os.path.abspath(__file__))

class SPAHandler(SimpleHTTPRequestHandler):
    # Force correct MIME types (Windows + module scripts)
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
        ".map": "application/json",
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        # Strip query params
        path = urllib.parse.urlparse(self.path).path

        # Resolve to local file path
        local_path = self.translate_path(path)

        # SPA fallback: if route doesn't exist as a file, serve index.html
        # (Lets React Router routes like /dashboard work on refresh)
        if not os.path.exists(local_path):
            self.path = "/index.html"

        return super().do_GET()

if __name__ == "__main__":
    port = 3000
    server = ThreadingHTTPServer(("127.0.0.1", port), SPAHandler)
    print(f"Serving dist on http://127.0.0.1:{port}")
    server.serve_forever()

