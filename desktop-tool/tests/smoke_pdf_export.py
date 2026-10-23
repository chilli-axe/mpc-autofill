"""Smoke test a packaged executable, or source CLI by default, without accounts or downloads."""

import argparse
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / "autofill.py")
    parser.add_argument("--icc-profile", type=Path, default=Path("/usr/share/color/icc/ghostscript/default_cmyk.icc"))
    args = parser.parse_args()
    assert args.icc_profile.is_file(), f"ICC profile is missing: {args.icc_profile}"
    command = [str(args.executable.resolve())]
    if args.executable.suffix == ".py":
        command.insert(0, sys.executable)

    with tempfile.TemporaryDirectory(prefix="mpc-pdf-smoke-") as directory:
        work = Path(directory)
        front, back = work / "front.png", work / "back.png"
        for path, color in [(front, "red"), (back, "blue")]:
            Image.new("RGB", (82, 111), color).save(path)

        def card(path):
            return (
                f"<card><id>{escape(str(path))}</id><sourceType>Local File</sourceType>"
                f"<slots>1,3</slots><name>{path.name}</name></card>"
            )

        (work / "order.xml").write_text(
            "<order><details><quantity>4</quantity><stock>(S30) Standard Smooth</stock><foil>false</foil></details>"
            f"<fronts>{card(front)}</fronts><backs>{card(back)}</backs><cardback></cardback></order>",
            encoding="utf-8",
        )
        command += [
            "--directory",
            str(work),
            "--site",
            "DriveThruCards",
            "--exportpdf",
            "--allowsleep",
            "--dtc-icc-profile",
            str(args.icc_profile.resolve()),
            "--skip-pdf-if-exists",
        ]

        def run():
            result = subprocess.run(command, input="", capture_output=True, text=True, timeout=120)
            output = result.stdout + result.stderr
            assert result.returncode == 0, output
            return output

        def snapshot():
            return {
                path.name: (path.stat().st_mtime_ns, hashlib.sha256(path.read_bytes()).hexdigest())
                for path in (work / "export/order").glob("*.pdf")
            }

        output = run()
        original = snapshot()
        assert set(original) == {"1.pdf", "1_pdfx.pdf"}, output
        pdf = (work / "export/order/1_pdfx.pdf").read_bytes()
        assert b"(PDF/X-1a:2001)" in pdf and b"/OutputIntents" in pdf
        assert len(re.findall(rb"/Type\s*/Page\b", pdf)) == 4
        assert "Reusing PDF export" in run()
        assert snapshot() == original, "Identical inputs should preserve PDF bytes and modification times"
        previous = front.stat()
        Image.new("RGB", (82, 111), "yellow").save(front)
        os.utime(front, ns=(previous.st_atime_ns, previous.st_mtime_ns))
        assert front.stat().st_mtime_ns == previous.st_mtime_ns
        assert "Reusing PDF export" not in run()
        rebuilt = snapshot()
        assert rebuilt.keys() == original.keys()
        assert all(rebuilt[name][1] != original[name][1] for name in original), "Changed image bytes must rebuild PDFs"
    print("PDF export smoke passed: PDF/X conversion, identical reuse, changed-image rebuild.")


if __name__ == "__main__":
    main()
