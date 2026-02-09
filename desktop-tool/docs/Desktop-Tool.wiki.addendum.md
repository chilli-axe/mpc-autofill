# Desktop Tool Wiki Addendum (PR Patch)

This file contains only the incremental wiki updates introduced in this PR.
Target page: <https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool>

## Insert Under Existing "Useful CLI Flags" Section

### PDF/Export Flags (add these bullets if missing)

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

### Browser/Profile Flags (add these bullets if missing)

- `--browser-profile-path`
  - Use an existing Chromium user data directory (cookies/session/password managers).

- `--browser-profile-name`
  - Select the profile directory inside the user data folder (default: `Default`).

- `--dtc-custom-stealth`
  - Optional extra stealth JavaScript for DriveThruCards.
  - Use only as a last resort if default automation gets stuck around Cloudflare/login checks.
  - Disabled by default because it can increase bot-detection risk on some runs.

### Logging Flag (add subsection if missing)

- `--log-level`
  - Global CLI verbosity control.
  - Use `DEBUG` to show detailed Selenium step-by-step logs.

## Insert Under Existing Notes/Behavior Section

- During PDF/X conversion, CLI status reports progress per file (`Converting PDF to PDF/X-1a (n/total)`).
- Build/bundled desktop artifacts include the full `assets/` directory.
- DriveThruCards now explicitly asks for confirmation before attempting Ghostscript installation.
