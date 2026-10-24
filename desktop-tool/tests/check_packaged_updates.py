"""Black-box update checks against two test-version release builds, with isolated settings.

Adapted from the Windows PR #11 platform-testing handoff. Run as a script, not pytest.
The embedded test version must be older than the repository's latest stable release.
"""

import argparse
import hashlib
import json
import os
import platform
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path


class Terminal:
    def __init__(self, command, env, cwd):
        self.output = ""
        if os.name == "nt":
            from winpty import PtyProcess

            self.child = PtyProcess.spawn(command, env=env, cwd=str(cwd), dimensions=(40, 140))
            self.child.fileobj.settimeout(0.2)
        else:
            import pexpect

            self.child = pexpect.spawn(
                shlex.join(command), env=env, cwd=str(cwd), encoding="utf-8", dimensions=(40, 140)
            )

    def read(self):
        try:
            if os.name == "nt":
                self.output += self.child.read(65536)
            else:
                self.output += self.child.read_nonblocking(65536, timeout=0.2)
        except EOFError, socket.timeout:
            pass
        except Exception as error:
            if type(error).__name__ not in ("EOF", "TIMEOUT"):
                raise

    def until(self, text, timeout=90):
        deadline = time.monotonic() + timeout
        while text not in self.output and time.monotonic() < deadline:
            self.read()
            if not self.child.isalive():
                self.read()
                break
        assert text in self.output, f"Did not reach {text!r}:\n{self.output}"

    def send(self, text):
        if os.name == "nt":
            self.child.write(text.replace("\n", "\r\n"))
        else:
            self.child.send(text)

    def finish(self, timeout=90):
        deadline = time.monotonic() + timeout
        while self.child.isalive() and time.monotonic() < deadline:
            self.read()
        assert not self.child.isalive(), f"Process did not exit:\n{self.output}"
        for _ in range(3):
            self.read()
        return self.child.wait()

    def close(self):
        if self.child.isalive():
            self.child.terminate(force=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("platform-results"))
    parser.add_argument("--version", default="1.2.3")
    parser.add_argument("--replacement", type=Path)
    args = parser.parse_args()
    root = args.output.resolve()
    root.mkdir(parents=True, exist_ok=True)
    original = args.executable.resolve()
    binary_dir = root / "bundle away from source"
    binary_dir.mkdir(exist_ok=True)
    binary = binary_dir / original.name
    shutil.copy2(original, binary)
    binary.chmod(binary.stat().st_mode | 0o111)
    env = os.environ.copy()
    settings = root / "isolated-settings"
    settings.mkdir(exist_ok=True)
    env.update(
        APPDATA=str(settings / "roaming"),
        XDG_CONFIG_HOME=str(settings / "config"),
        XDG_CACHE_HOME=str(settings / "cache"),
        TERM="xterm-256color",
        NO_COLOR="1",
    )
    if os.name != "nt":
        env["HOME"] = str(settings)
    if sys.platform == "win32":
        pref = settings / "roaming/mpc-autofill/update-checks/bwsinger/mpc-autofill.json"
    elif sys.platform == "darwin":
        pref = settings / "Library/Application Support/mpc-autofill/update-checks/bwsinger/mpc-autofill.json"
    else:
        pref = settings / "config/mpc-autofill/update-checks/bwsinger/mpc-autofill.json"
    browser_log = root / "browser-url.txt"
    probe = root / "browser_probe.py"
    probe.write_text(
        "import pathlib,sys\npathlib.Path(sys.argv[1]).write_text(sys.argv[2], encoding='utf-8')\n", encoding="utf-8"
    )
    # Use forward slashes so BROWSER's platform path separator cannot split Windows drive letters.
    # On Windows webbrowser uses ';', on POSIX paths contain no drive letters.
    env["BROWSER"] = f'"{Path(sys.executable).as_posix()}" "{probe.as_posix()}" "{browser_log.as_posix()}" %s'
    missing = root / "must-not-create-order-directory"
    order_args = ["--directory", str(missing)]
    consent = "Check GitHub (bwsinger/mpc-autofill) for new versions on startup?"
    offer = "Open the release page to download it and stop this run?"
    continuation = "Working directory was specified but is not a directory"
    results = []
    version_text = f"MPC Autofill {args.version} (bwsinger/mpc-autofill)"
    terminals = []
    if os.name == "nt":
        import ctypes

        native_cache = ctypes.create_unicode_buffer(32768)
        assert ctypes.windll.shell32.SHGetFolderPathW(None, 28, None, 0, native_cache) == 0
        cache_root = Path(native_cache.value) / "mpc-autofill"
    else:
        cache_root = Path(env["XDG_CACHE_HOME"]) / "mpc-autofill"
    cache_evidence = {}

    def cache_names():
        return sorted(path.name for path in cache_root.iterdir() if path.is_dir()) if cache_root.exists() else []

    def run(name, arguments, extra_env=None):
        completed = subprocess.run(
            [str(binary), *arguments],
            cwd=binary_dir,
            env=env | (extra_env or {}),
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = completed.stdout + completed.stderr
        (root / f"{name}.log").write_text(output, encoding="utf-8")
        return completed.returncode, output

    def interactive(arguments, extra_env=None):
        term = Terminal([str(binary), *arguments], env | (extra_env or {}), binary_dir)
        terminals.append(term)
        return term

    def record(name, assertion):
        start = time.monotonic()
        try:
            assertion()
            results.append({"name": name, "status": "passed", "seconds": round(time.monotonic() - start, 2)})
            print(f"PASS {name}", flush=True)
        except Exception as error:
            results.append({"name": name, "status": "failed", "error": str(error)})
            print(f"FAIL {name}: {error}", flush=True)
            raise
        finally:
            for index, term in enumerate(terminals):
                term.close()
                (root / f"{name}-terminal-{index}.log").write_text(term.output, encoding="utf-8")
            terminals.clear()

    def preference(expected):
        assert pref.exists(), f"Preference absent at {pref}"
        assert json.loads(pref.read_text(encoding="utf-8")) == {"enabled": expected}

    def diagnostic_checks():
        code, output = run("version", ["--version"])
        assert code == 0 and output.strip() == version_text, output
        code, output = run("help", ["--check-updates", "--help"])
        assert code == 0 and "MakePlayingCards" in output and "DriveThruCards" in output, output
        code, output = run("tls", ["--check-updates", "--check-tls"])
        assert code == 0 and "TLS check succeeded" in output, output
        assert not pref.exists()
        cache_evidence["first_build"] = cache_names()

    def headless():
        code, output = run("headless-default", order_args)
        assert code != 0 and continuation in output, output
        assert consent not in output and "Download:" not in output and not pref.exists()

    def decline_and_restart():
        term = interactive(order_args)
        term.until(consent)
        assert "Download:" not in term.output
        term.send("n\n")
        term.until(continuation)
        assert term.finish() != 0
        preference(False)
        second = interactive(order_args)
        second.until(continuation)
        assert second.finish() != 0
        assert consent not in second.output and offer not in second.output

    def headless_explicit():
        code, output = run("headless-explicit", ["--check-updates", *order_args])
        assert (
            code != 0
            and continuation in output
            and "Download: https://github.com/bwsinger/mpc-autofill/releases/tag/" in output
        ), output
        assert consent not in output and offer not in output and not browser_log.exists()
        preference(True)
        code, output = run("headless-remembered-yes", order_args)
        assert "Download:" not in output and offer not in output, output
        preference(True)
        code, output = run("headless-disable", ["--no-check-updates", *order_args])
        assert code != 0 and continuation in output and "Download:" not in output, output
        preference(False)

    def declined_notice():
        term = interactive(["--check-updates", *order_args])
        term.until(offer)
        assert consent not in term.output and "installed: 1.2.3" in term.output
        term.send("n\n")
        term.until(continuation)
        assert term.finish() != 0
        assert not browser_log.exists()
        preference(True)

    def accept_and_stop():
        term = interactive(["--check-updates", *order_args])
        term.until(offer)
        term.send("y\n")
        assert term.finish() == 0, term.output
        assert browser_log.exists(), term.output
        url = browser_log.read_text(encoding="utf-8")
        assert re.fullmatch(
            r"https://github.com/bwsinger/mpc-autofill/releases/tag/(?:dtc-)?v?[0-9]+(?:\.[0-9]+){1,3}", url
        ), url
        assert continuation not in term.output and not missing.exists()
        preference(True)

    def move_and_replace():
        nonlocal binary, binary_dir
        binary_dir = root / "moved again with spaces"
        binary_dir.mkdir(exist_ok=True)
        moved = binary_dir / ("renamed-autofill.exe" if os.name == "nt" else "renamed-autofill")
        shutil.move(binary, moved)
        binary = moved
        code, output = run("moved-version", ["--version"])
        assert code == 0 and output.strip() == version_text, output
        # Replace the file from the artifact, retaining only the external preference.
        replacement_file = binary.with_name(binary.name + ".replacement")
        shutil.copy2(original, replacement_file)
        os.replace(replacement_file, binary)
        binary.chmod(binary.stat().st_mode | 0o111)
        term = interactive(order_args)
        term.until(offer)
        assert consent not in term.output
        term.send("n\n")
        term.until(continuation)
        term.finish()
        preference(True)

    def disable_and_onboarding():
        term = interactive(["--no-check-updates"])
        term.until("Which web browser should the tool run on?")
        assert consent not in term.output and offer not in term.output
        preference(False)
        term.close()
        second = interactive([])
        second.until("Which web browser should the tool run on?")
        assert consent not in second.output and offer not in second.output
        preference(False)

    def enable_only_onboarding():
        term = interactive(["--check-updates"])
        term.until(offer)
        term.send("n\n")
        term.until("Which web browser should the tool run on?")
        assert consent not in term.output
        preference(True)

    def offline():
        proxy = {
            "HTTPS_PROXY": "http://127.0.0.1:9",
            "https_proxy": "http://127.0.0.1:9",
            "NO_PROXY": "",
            "no_proxy": "",
        }
        term = interactive(["--check-updates", *order_args], proxy)
        term.until("Update check unavailable; continuing with this version.")
        term.until(continuation)
        assert term.finish() != 0
        preference(True)

    def malformed():
        pref.write_text('{"enabled":"true"}', encoding="utf-8")
        term = interactive(order_args)
        term.until(consent)
        term.send("n\n")
        term.until(continuation)
        term.finish()
        preference(False)

    def first_yes():
        pref.unlink()
        term = interactive(order_args)
        term.until(consent)
        term.send("y\n")
        term.until(offer)
        term.send("n\n")
        term.until(continuation)
        term.finish()
        preference(True)

    def independently_rebuilt_replacement():
        replacement = args.replacement.resolve()
        assert hashlib.sha256(replacement.read_bytes()).hexdigest() != hashlib.sha256(original.read_bytes()).hexdigest()
        preference(True)
        before = cache_names()
        # Replace the outer executable's inode, as a normal file-manager upgrade does.
        # The extracted inner executable must still get a different cache directory.
        replacement_file = binary.with_name(binary.name + ".replacement")
        shutil.copy2(replacement, replacement_file)
        os.replace(replacement_file, binary)
        binary.chmod(binary.stat().st_mode | 0o111)
        code, output = run("rebuilt-version", ["--version"])
        assert code == 0 and output.strip() == version_text, output
        after = cache_names()
        assert before and after and set(after).difference(before), (before, after)
        cache_evidence["replacement_build"] = after
        term = interactive(order_args)
        term.until(offer)
        assert consent not in term.output
        term.send("n\n")
        term.until(continuation)
        term.finish()
        preference(True)
        code, output = run("rebuilt-disable", ["--no-check-updates", *order_args])
        assert code != 0 and continuation in output and "Download:" not in output, output
        preference(False)

    try:
        for name, test in [
            ("diagnostic-bypass-and-embedded-identity", diagnostic_checks),
            ("headless-default-does-not-write-settings", headless),
            ("declined-consent-persists-across-restarts", decline_and_restart),
            ("headless-explicit-flags-and-saved-consent", headless_explicit),
            ("declined-update-continues", declined_notice),
            ("accepted-update-hands-off-url-and-stops", accept_and_stop),
            ("moved-and-replaced-executable-keeps-consent", move_and_replace),
            ("disable-flag-and-ordinary-onboarding", disable_and_onboarding),
            ("enable-only-flag-retains-onboarding", enable_only_onboarding),
            ("offline-check-continues", offline),
            ("malformed-consent-prompts-again", malformed),
            ("first-run-yes-checks-and-persists", first_yes),
        ]:
            record(name, test)
        if args.replacement:
            record(
                "independently-rebuilt-replacement-uses-new-cache-and-keeps-consent", independently_rebuilt_replacement
            )
    finally:
        summary = {
            "platform": platform.platform(),
            "architecture": platform.machine(),
            "python": sys.version,
            "artifact_sha256": hashlib.sha256(original.read_bytes()).hexdigest(),
            "replacement_sha256": (
                hashlib.sha256(args.replacement.read_bytes()).hexdigest() if args.replacement else None
            ),
            "version": args.version,
            "preference_path": str(pref),
            "cache_root": str(cache_root),
            "cache_directories": cache_evidence,
            "results": results,
            "limitations": [
                "Browser handoff captured by a test command; default GUI browser was not inspected.",
                "Both independently compiled builds use test version 1.2.3; numeric upgrade ordering is covered by unit tests.",
                "Order-directory validation deliberately stops continuation before order processing.",
            ],
        }
        (root / "results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
