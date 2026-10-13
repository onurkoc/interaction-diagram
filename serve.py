"""
Local web server for the app in the folder app/ (standard library only).

    python serve.py              serve app/ on http://localhost:8000/ and
                                 open the page in the browser
    python serve.py --no-browser only serve
    python serve.py --port 8080  another port

Differences to "python -m http.server":
- .js and .mjs are always sent as text/javascript. The standard server
  takes the type from the Windows registry, which can be wrong; browsers
  then refuse to load the modules.
- Cache-Control: no-store, so the browser never shows an old version of
  the files after a change.
- Only reachable from this computer (127.0.0.1).
"""
import argparse
import functools
import http.server
import os
import threading
import webbrowser

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app')


class Handler(http.server.SimpleHTTPRequestHandler):
    # fixed types, independent of the registry of Windows
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html; charset=utf-8',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        # never use a stored copy
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description='Serve the folder app/.')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true',
                        help='do not open the page in the browser')
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=APP)
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port),
                                                 handler)
    except OSError as error:
        print(f'Port {args.port} cannot be used: {error}')
        print('Is the server already running? Otherwise: '
              'python serve.py --port 8080')
        return 1

    url = f'http://localhost:{args.port}/'
    print(f'Interaction diagram: {url}')
    print('Stop the server with Ctrl+C.')
    if not args.no_browser:
        # the socket is listening now, so the page can be opened;
        # the request waits until serve_forever answers it
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
