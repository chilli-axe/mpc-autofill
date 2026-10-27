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

# Compiler plus runtime; requires client_secrets.json and a unique product name per build
uv sync --locked --no-default-groups --group build
uv run --locked --no-default-groups --group build python write_build_info.py --version 1.2.6 --repository bwsinger/mpc-autofill
uv run --locked --no-default-groups --group build python -m nuitka --output-dir=build --file-version=1.2.6 --product-name=mpc-autofill-local-build-UNIQUE autofill.py
```

Keep the same group arguments on `uv run`; otherwise uv can synchronize a different environment. Nuitka uses Python 3.14's `compression.zstd`. Setuptools remains a runtime dependency because undetected-chromedriver still imports its distutils shim. Isolated source-build backend constraints are separate from runtime pins.

CI checks Nuitka's compressor before compilation. Python distributions with single-threaded Zstandard need Nuitka's `--low-memory` option; CI selects it automatically while preserving parallel C compilation. For a local build, run `uv run --locked --no-default-groups --group build python tests/check_onefile_compression.py` and add any flags it prints to the Nuitka command. This mode uses lighter executable-payload compression; it does not change card-image or PDF compression.

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
Release executables offer optional update checks at first interactive startup. The choice is remembered across upgrades.
See [update checks](docs/update-checks.md) for settings, build instructions, and the reviewed implementation plan.

### Performance gates

Every desktop pull request runs source performance checks on Windows, Linux and macOS. Both desktop build workflows and package validation also run them against each native executable, including Intel and Apple Silicon Macs. A failed budget prevents the build from reaching artifact upload. Timings and terminal transcripts are saved as workflow artifacts and summarized in the job output.

From `desktop-tool`, with supported Ghostscript and the SWOP profile installed:

```sh
uv run --locked --group dev python tests/check_performance.py
uv run --locked --group dev python tests/check_performance.py build/autofill-windows.exe
```

The offline workload has 120 cards and 41 unique cached images at 600 DPI. It checks cache contents and modification times, 240-page PDF/X output, and PDF reuse preserving output bytes and modification times. Each phase runs with captured output and in a real terminal: cached-image handling has a 20-second budget, PDF/X export 90 seconds (120 seconds on Intel Macs, whose baseline is about 85 seconds), and reuse 15 seconds. Interactive runs must also finish within twice the captured duration or ten extra seconds, whichever is larger. First-run executable extraction is warmed before measurement. The limits allow hosted-runner variation while rejecting long per-image or per-card stalls; they are performance smoke checks, not a guarantee of every deck's processing time.

The separate fast terminal test in pytest exercises startup and 30 status updates within 15 seconds on every OS. This catches terminal libraries that wait for capability or cursor-position replies. Capturing all test output alone cannot exercise that path.
