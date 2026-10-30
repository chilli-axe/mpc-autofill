# MPC Autofill Desktop Tool

Our docs are available in the repo's [Wiki](https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool).

For this fork's DriveThruCards setup, command-line options, tests, and local builds, see the [desktop tool guide](docs/Desktop-Tool.wiki.addendum.md). Release builds can check GitHub for updates; see [update checks](docs/update-checks.md).

## Development

Development uses **Python 3.14.9** and **uv 0.13.5**. From `desktop-tool/`:

```sh
uv sync --locked --group dev
uv run --locked --group dev python -m pytest .
uv run --locked --no-default-groups python autofill.py --help
```

On Linux, prefix the tests with `dbus-run-session --`. Browser tests need Chrome and a matching driver; set `CHROME_BINARY` and `CHROMEDRIVER` to pick specific executables. Tests that need Google Drive skip themselves when `client_secrets.json` is missing.

DriveThruCards PDF/X-1a exports need Ghostscript **10.05 or newer**.

Run the style and type checks from the repository root:

```sh
uv run --project desktop-tool --locked --group dev ruff check --config desktop-tool/pyproject.toml desktop-tool
uv run --project desktop-tool --locked --group dev black --check desktop-tool
uv run --project desktop-tool --locked --group dev isort --check-only desktop-tool
uv run --project desktop-tool --locked --group dev mypy --config-file desktop-tool/pyproject.toml desktop-tool/autofill.py desktop-tool/src
```

CI runs mypy on Windows, Linux, and macOS because `sys.platform` checks narrow differently on each. Locally, add `--platform linux` or `--platform win32` to check the other platforms.

## Dependencies

Dependencies live in `pyproject.toml` and `uv.lock`, split into runtime, `dev`, and `build` groups. Pass the same group arguments to `uv run` that you used for `uv sync`, or uv will sync a different environment.

`requirements.txt` is a generated pip export of every group. CI fails if it is stale, so regenerate it after changing dependencies instead of editing it:

```sh
uv lock
uv export --locked --all-groups --no-emit-project --no-header --format requirements-txt --output-file requirements.txt
```

## Building

A build needs `client_secrets.json` and a product name that is unique to each build:

```sh
uv sync --locked --no-default-groups --group build
uv run --locked --no-default-groups --group build python write_build_info.py --version 1.2.6 --repository bwsinger/mpc-autofill
uv run --locked --no-default-groups --group build python -m nuitka --output-dir=build --file-version=1.2.6 --product-name=mpc-autofill-local-build-UNIQUE autofill.py
```

Some Python distributions only support single-threaded Zstandard compression, which Nuitka's default settings can't use. Run `uv run --locked --no-default-groups --group build python tests/check_onefile_compression.py` first and add any flags it prints to the Nuitka command.

Restore `src/build_info.py` to its source defaults before committing. Local builds use Nuitka's default file name (for example, `build/autofill.bin` on Linux), while CI names its artifacts `autofill-linux.bin`, `autofill-windows.exe`, and two macOS `.command` files.

## PDF and performance checks

These need a supported Ghostscript and Adobe's US Web Coated (SWOP) profile, which both scripts read from `~/.mpc-autofill/USWebCoatedSWOP.icc` unless you pass `--icc-profile`. Pass a built executable as the first argument to check it instead of the source:

```sh
uv run --locked --group dev python tests/smoke_pdf_export.py
uv run --locked --group dev python tests/check_performance.py build/autofill-windows.exe
```

The smoke test renders the exported pages and checks their size, back and front order, embedded profile, and PDF reuse. The performance check exports a 120-card deck and fails if image caching, PDF/X export, or PDF reuse exceeds its time budget. Every desktop pull request runs it on Windows, Linux, and macOS, and the build workflows run it against each packaged executable.
