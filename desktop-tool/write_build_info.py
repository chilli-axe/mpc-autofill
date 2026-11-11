"""Embed the release version and source repository before a Nuitka build."""

import argparse
import re
from pathlib import Path


def write_build_info(version: str, repository: str, destination: Path) -> None:
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", version):
        raise ValueError("Version must contain 2 to 4 numeric components, e.g. 1.2.4.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_][A-Za-z0-9_.-]*", repository):
        raise ValueError("Repository must be a GitHub owner/repository name.")
    destination.write_text(
        f'"""Generated release identity; do not edit."""\n\n'
        f"VERSION: str | None = {version!r}\nRELEASE_REPOSITORY: str | None = {repository!r}\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--repository", required=True)
    args = parser.parse_args()
    try:
        write_build_info(args.version, args.repository, Path(__file__).parent / "src" / "build_info.py")
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
