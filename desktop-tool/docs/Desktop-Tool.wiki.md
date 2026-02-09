# Desktop Tool

The desktop tool automates order creation workflows and supports DriveThruCards PDF upload.

## DriveThruCards Workflow

### Ghostscript Requirement

DriveThruCards export requires PDF/X-1a conversion via Ghostscript.

Install Ghostscript:

- macOS: `brew install ghostscript`
- Ubuntu/Debian: `sudo apt install -y ghostscript`
- Fedora: `sudo dnf install -y ghostscript`
- Windows: install from <https://ghostscript.com/releases/gsdnld.html>
  - Optional: `winget install --id ArtifexSoftware.Ghostscript`

The CLI checks Ghostscript availability before DriveThruCards processing and guides install/retry when missing.

### Standard DriveThruCards Run

```bash
.venv/bin/python autofill.py --site drivethrucards --directory /Users/bradley/Documents/dtc-test
```

## Useful CLI Flags

### PDF/Export Flags

- `--skip-pdf-if-exists`
  - Reuse existing exported PDFs when present for the order.
  - If files in `cards/` are newer than existing PDFs, the CLI prompts whether to recreate.
  - For DriveThruCards, existing files are reused only when a `_pdfx.pdf` output exists.

- `--download-images-only`
  - Download all card images to `cards/` and exit.
  - Skips PDF creation and browser automation.

- `--dtc-icc-profile`
  - Override the default bundled ICC profile used during DriveThruCards PDF/X conversion.
  - Useful if your print workflow requires a specific ICC profile.

### Browser Profile Flags

- `--browser-profile-path`
  - Use an existing Chromium user data directory (cookies/session/password managers).
- `--browser-profile-name`
  - Select the profile directory inside the user data folder (default: `Default`).
- `--dtc-custom-stealth`
  - Enable additional custom stealth JavaScript for DriveThruCards.
  - Use this as a last resort when the default `undetected-chromedriver` behavior is not sufficient.
  - Disabled by default because extra JS patches can trigger bot detection on some runs.

These are useful for DriveThruCards login reliability when bot detection blocks fresh sessions.

### Logging Flag

- `--log-level`
  - Global CLI verbosity control.
  - Use `DEBUG` to show detailed Selenium step-by-step logs.

## Notes

- During PDF/X conversion, CLI status now reports progress per file (`Converting PDF to PDF/X-1a (n/total)`).
- Build/bundled desktop artifacts include the full `assets/` directory.
