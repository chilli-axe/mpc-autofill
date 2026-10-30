"""Smoke test a packaged executable, or source CLI by default, without accounts or downloads."""

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / "autofill.py")
    parser.add_argument("--icc-profile", type=Path, default=Path.home() / ".mpc-autofill/USWebCoatedSWOP.icc")
    args = parser.parse_args()
    assert args.icc_profile.is_file(), f"ICC profile is missing: {args.icc_profile}"
    command = [str(args.executable.resolve())]
    if args.executable.suffix == ".py":
        command.insert(0, sys.executable)

    with tempfile.TemporaryDirectory(prefix="mpc-pdf-smoke-") as directory:
        work = Path(directory)
        front, back = work / "front.png", work / "back.png"
        for path, color in [(front, "red"), (back, "blue")]:
            image = Image.new("RGB", (82, 111), color)
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 0, 81, 110), outline="white", width=4)
            draw.rectangle((0, 0, 9, 9), fill="lime")
            image.save(path)

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
            "--dtc-icc-profile",
            str(args.icc_profile.resolve()),
        ]

        def run(*flags):
            result = subprocess.run(command + list(flags), input="", capture_output=True, text=True, timeout=120)
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
        streams = []
        for match in re.finditer(rb"(<<.*?>>)\s*stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
            header, data = match.groups()
            streams.append(zlib.decompress(data) if b"/FlateDecode" in header else data)
        assert args.icc_profile.read_bytes() in streams, "Requested ICC profile must be embedded unchanged"
        gs = next((path for name in ["gs", "gswin64c", "gswin32c"] if (path := shutil.which(name))), None)
        assert gs, "A supported Ghostscript is required for raster validation"
        subprocess.run(
            [
                gs,
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=png16m",
                "-r100",
                f"-sOutputFile={work}/page-%02d.png",
                str(work / "export/order/1_pdfx.pdf"),
            ],
            check=True,
            capture_output=True,
        )
        pages = sorted(work.glob("page-*.png"))
        assert len(pages) == 4
        # DTC's existing export contract is back, front for each populated slot.
        for page, front_face in zip(pages, [False, True, False, True], strict=True):
            with Image.open(page) as image:
                assert image.size == (273, 371), f"Unexpected physical page dimensions: {image.size}"
                red, _green, blue = image.convert("RGB").getpixel((136, 185))
                assert (red > blue + 40) if front_face else (blue > red + 40), f"Wrong or blank face: {page.name}"
                red, green, blue = image.getpixel((15, 15))
                assert green > red + 30 and green > blue + 30, "Top-left marker must preserve orientation"
                for position in [(136, 5), (267, 185), (136, 365), (5, 185)]:
                    assert min(image.getpixel(position)) > 220, "White edge must not be cropped"
        assert "Reusing PDF export" in run()
        assert snapshot() == original, "Identical inputs should preserve PDF bytes and modification times"
        assert "Reusing PDF export" not in run("--no-skip-pdf-if-exists")
        forced = snapshot()
        assert all(forced[name][0] != original[name][0] for name in original), "Explicit rebuild must rewrite PDFs"
        previous = front.stat()
        Image.new("RGB", (82, 111), "yellow").save(front)
        os.utime(front, ns=(previous.st_atime_ns, previous.st_mtime_ns))
        assert front.stat().st_mtime_ns == previous.st_mtime_ns
        assert "Reusing PDF export" not in run()
        rebuilt = snapshot()
        assert rebuilt.keys() == original.keys()
        assert all(rebuilt[name][1] != original[name][1] for name in original), "Changed image bytes must rebuild PDFs"
    print("PDF export smoke passed: rendered dimensions/faces, embedded profile, PDF/X markers, reuse and rebuild.")


if __name__ == "__main__":
    main()
