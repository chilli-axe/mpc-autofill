"""Exercise progress rendering in a real terminal on every supported OS."""

import os
import sys
from pathlib import Path

from tests.check_packaged_updates import Terminal


def test_progress_updates_do_not_wait_for_terminal_responses():
    code = """
import enlighten

manager = enlighten.get_manager()
status = manager.status_bar(status_format='State: {state}', state='Starting', leave=False)
try:
    for slot in range(30):
        status.update(state=f'Working on slot {slot}')
        status.refresh()
finally:
    status.close(clear=True)
    manager.stop()
print('Progress finished')
"""
    env = dict(os.environ, TERM="xterm-256color")
    terminal = Terminal([sys.executable, "-c", code], env, Path.cwd())
    try:
        assert terminal.finish(timeout=15) == 0, terminal.output
        assert "Progress finished" in terminal.output
    finally:
        terminal.close()
