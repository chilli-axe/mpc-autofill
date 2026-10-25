"""Bound cached-image, PDF/X export and reuse times in captured and interactive runs.

Run from desktop-tool: uv run --locked --group dev python tests/check_performance.py [executable]
"""

import argparse
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from check_packaged_updates import Terminal
from PIL import Image, ImageDraw


def snapshot(paths):
    result = {}
    for path in paths:
        with path.open("rb") as file:
            result[path.name] = (path.stat().st_mtime_ns, hashlib.file_digest(file, "sha256").hexdigest())
    return result


def make_order(work):
    cards = work / "cards"
    cards.mkdir()
    fronts = []
    for index in range(41):
        path = cards / f"image-{index}.png"
        image = Image.new("RGB", (1638, 2226), (index * 5 % 256, index * 17 % 256, index * 31 % 256))
        draw = ImageDraw.Draw(image)
        for y in range(0, image.height, 32):
            draw.line((0, y, image.width, image.height - y), fill="white", width=5)
        image.save(path)
        if index < 40:
            slots = ",".join(str(slot) for slot in range(index * 3, index * 3 + 3))
            fronts.append(f"<card><id>cached-{index}</id><name>{path.name}</name><slots>{slots}</slots></card>")
    slots = ",".join(str(slot) for slot in range(120))
    (work / "order.xml").write_text(
        "<order><details><quantity>120</quantity><stock>(S30) Standard Smooth</stock><foil>false</foil></details>"
        f"<fronts>{''.join(fronts)}</fronts><backs><card><id>cached-back</id><name>image-40.png</name>"
        f"<slots>{slots}</slots></card></backs><cardback/></order>",
        encoding="utf-8",
    )
    return cards


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / "autofill.py")
    parser.add_argument("--icc-profile", type=Path, default=Path.home() / ".mpc-autofill/USWebCoatedSWOP.icc")
    parser.add_argument("--output", type=Path, default=Path("performance-results"))
    args = parser.parse_args()
    profile = args.icc_profile.resolve()
    assert profile.is_file(), f"ICC profile is missing: {profile}"
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    executable = args.executable.resolve()
    command = [str(executable)]
    if executable.suffix == ".py":
        command.insert(0, sys.executable)
    results = {"platform": platform.platform(), "executable": str(executable), "passed": False, "cases": []}
    try:
        with tempfile.TemporaryDirectory(prefix="mpc-performance-") as directory:
            work = Path(directory)
            cards = make_order(work)
            cached = snapshot(cards.iterdir())
            settings = work / "settings"
            settings.mkdir()
            env = dict(os.environ)
            env.update(
                APPDATA=str(settings),
                XDG_CONFIG_HOME=str(settings),
                XDG_CACHE_HOME=str(settings / "cache"),
                TERM="xterm-256color",
                PYTHONUTF8="1",
            )
            if os.name != "nt":
                env["HOME"] = str(settings)
            # Exclude first-run onefile extraction from the measured work.
            identity = subprocess.run(
                command + ["--version"], cwd=work, env=env, capture_output=True, text=True, check=True, timeout=60
            )
            results["identity"] = identity.stdout.strip()
            command += ["--directory", str(work), "--site", "DriveThruCards", "--allowsleep", "--no-check-updates"]

            def run(name, flags, interactive, budget):
                label = f"{name}-{'terminal' if interactive else 'captured'}"
                case = {"name": label, "budget_seconds": budget, "passed": False}
                results["cases"].append(case)
                transcript = ""
                terminal = None
                started = time.monotonic()
                try:
                    if interactive:
                        terminal = Terminal(command + flags, env, work)
                        code = terminal.finish(timeout=budget)
                        transcript = terminal.output
                    else:
                        process = subprocess.run(
                            command + flags, input="", cwd=work, env=env, capture_output=True, text=True, timeout=budget
                        )
                        code, transcript = process.returncode, process.stdout + process.stderr
                    assert code == 0, transcript
                    assert snapshot(cards.iterdir()) == cached, "Cached images were changed or downloaded again"
                    case["passed"] = True
                    return transcript
                finally:
                    if terminal:
                        transcript = terminal.output
                        terminal.close()
                    case["seconds"] = round(time.monotonic() - started, 3)
                    (output / f"{label}.log").write_text(transcript, encoding="utf-8")
                    print(json.dumps(case), flush=True)

            exported = work / "export/order"
            original = None
            for name, flags, budget in [
                ("cached-images", ["--download-images-only"], 20),
                ("pdf-export", ["--exportpdf", "--dtc-icc-profile", str(profile)], 90),
                ("pdf-reuse", ["--exportpdf", "--dtc-icc-profile", str(profile), "--skip-pdf-if-exists"], 15),
            ]:
                for interactive in (False, True):
                    transcript = run(name, flags, interactive, budget)
                    if name == "cached-images":
                        assert "Finished downloading card images" in transcript
                    else:
                        if name == "pdf-export":
                            assert "Finished exporting files" in transcript
                        pdf = (exported / "1_pdfx.pdf").read_bytes()
                        assert b"(PDF/X-1a:2001)" in pdf and b"/OutputIntents" in pdf
                        assert len(re.findall(rb"/Type\s*/Page\b", pdf)) == 240
                    if name == "pdf-reuse":
                        assert "Reusing PDF export" in transcript
                        assert snapshot(exported.glob("*.pdf")) == original, "PDF reuse regenerated outputs"
                captured, terminal = results["cases"][-2:]
                limit = max(captured["seconds"] * 2, captured["seconds"] + 10)
                terminal["terminal_allowance_seconds"] = round(limit, 3)
                assert (
                    terminal["seconds"] <= limit
                ), f"Interactive {name} exceeded captured time allowance: {limit:.1f}s"
                if name == "pdf-export":
                    original = snapshot(exported.glob("*.pdf"))
        results["passed"] = True
        print("Performance checks passed: 120 cards, 41 cached images, PDF/X export and reuse in both output modes.")
    except Exception as error:
        results["failure"] = str(error)
        raise
    finally:
        (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
