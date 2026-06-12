"""Tiny static server for the Empower Write staging demo.
Sends Cache-Control: no-store so the browser ALWAYS fetches fresh files
(kills the recurring stale-cache problem while iterating). Serves the repo
root so the corrector's ../../y/ includes resolve. Not deployed."""
import http.server, socketserver, os

os.chdir(r'E:\vocab-trainer')

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
print('Empower Write staging: serving E:\\vocab-trainer on http://localhost:8830 (no-store)')
with socketserver.TCPServer(('', 8830), NoCache) as httpd:
    httpd.serve_forever()
