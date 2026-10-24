# MPC Autofill Desktop Tool

Our docs are available in the repo's [Wiki](https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool).

For this fork's DriveThruCards setup, command-line options, tests, and local builds, see the [desktop tool guide](docs/Desktop-Tool.wiki.addendum.md).

Development uses **Python 3.14.9** and **uv 0.13.5**. From `desktop-tool/`:

```sh
uv sync --locked --group dev
uv run --locked --group dev python -m pytest .
uv run --locked --no-default-groups python autofill.py --help
```

On Linux, prefix tests with `dbus-run-session --`. Browser tests require Chrome and its matching driver; set `CHROME_BINARY` and `CHROMEDRIVER` to select local executables. The real DTC driver smoke also starts undetected-chromedriver against a local page; it does not sign into DTC.

Ghostscript **10.05 or newer** is required for DTC PDF/X-1a exports. An old PATH executable does not override a supported standard installation. Explicitly selected executables must themselves be supported. Installation requires confirmation; an unsuccessful upgrade stops with instructions instead of reinstalling indefinitely.

Dependencies live in `pyproject.toml` and `uv.lock`. Runtime, development, and compilation have separate groups:

```sh
# Runtime only
uv sync --locked --no-default-groups
uv run --locked --no-default-groups python autofill.py

# Compiler plus runtime; requires client_secrets.json
uv sync --locked --no-default-groups --group build
uv run --locked --no-default-groups --group build python -m nuitka --output-dir=build --file-version=1.2.5 autofill.py
```

Keep the same group arguments on `uv run`; otherwise uv can synchronize a different environment. Nuitka uses Python 3.14's `compression.zstd`. Setuptools remains a runtime dependency because undetected-chromedriver still imports its distutils shim. Isolated source-build backend constraints are separate from runtime pins.

Local builds use Nuitka's default platform filename (for example, `build/autofill.bin` on Linux). CI explicitly names its artifacts `autofill-linux.bin`, `autofill-windows.exe`, and the two macOS `.command` files; adjust the smoke command's executable path accordingly.

`requirements.txt` is a generated **all-groups** pip compatibility export, including test and compilation tools. Regenerate it after intentional dependency changes:

```sh
uv lock
uv export --locked --all-groups --no-emit-project --no-header --format requirements-txt --output-file requirements.txt
```

Canonical CI builds use uv's lock and build constraints. A plain pip install is a compatibility path rather than the canonical build environment. Do not edit the export by hand.

From the repository root, run the isolated desktop checks:

```sh
uv run --project desktop-tool --locked --group dev ruff check --config desktop-tool/pyproject.toml desktop-tool
uv run --project desktop-tool --locked --group dev black --check desktop-tool
uv run --project desktop-tool --locked --group dev isort --check-only desktop-tool
uv run --project desktop-tool --locked --group dev mypy --config-file desktop-tool/pyproject.toml desktop-tool/autofill.py desktop-tool/src
```

For real source or bundled PDF checks, install supported Ghostscript and provide the production SWOP profile:

```sh
uv run --locked --group dev python tests/smoke_pdf_export.py --icc-profile /path/to/USWebCoatedSWOP.icc
uv run --locked --group dev python tests/smoke_pdf_export.py build/autofill-linux.bin --icc-profile /path/to/USWebCoatedSWOP.icc
```

The smoke renders exported pages and checks size, back/front order, embedded profile bytes, PDF/X identification, and content-based reuse/rebuild. It exercises wakepy's default path; a warning and continued execution are expected on headless systems. These are conversion/layout checks, not formal PDF/X certification or proof of physical sleep inhibition.

Signed and unsigned workflow entry points retain separate behavior and share locked setup/compiler steps. Linux compilation stays on Ubuntu 22.04; clean Debian 12 checks the resulting executable. macOS notarization and Windows Authenticode checks remain gates in the signed workflow. Dependency locks do not promise byte-identical binaries or pin the OS toolchain.

See the [reviewed modernization plan](docs/Modernization-Plan.md) for the release base, review decisions, and acceptance checks.
