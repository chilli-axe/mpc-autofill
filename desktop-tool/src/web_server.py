"""
This module spins up a simple web server for serving the landing page for the tool
(guiding the user back to the desktop tool to answer another question before it can proceed).
"""

import logging
import threading
from http import server
from pathlib import Path
from typing import Union

from src import constants


class _Handler(server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            Path(__file__).joinpath("../..").joinpath(constants.POST_LAUNCH_HTML_FILENAME).resolve().read_bytes()
        )

    def log_request(self, code: Union[int, str] = "-", size: Union[int, str] = "-") -> None:
        # Silence the request log.
        pass


class WebServer:
    def __init__(self) -> None:
        self._server = server.ThreadingHTTPServer(("", 0), _Handler)
        self._thread = threading.Thread(target=self._server.serve_forever)
        self._thread.start()
        logging.info(f"Web server started on {self.server_url()}")

    def server_url(self) -> str:
        return f"http://localhost:{self._server.socket.getsockname()[1]}/"

    def __del__(self) -> None:
        self._server.shutdown()
        self._thread.join()
