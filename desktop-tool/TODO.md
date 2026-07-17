# Desktop Tool - TODO

## Session 1: Platform Validation

- [x] Test Ghostscript install step on Windows
- [x] Test Ghostscript install step on Linux

### Context
- **Key files**: `tests/test_desktop_tool.py`, `autofill.py`
- **Findings**: Added mocked platform tests for `ensure_ghostscript_available()` validating Windows `winget` and Linux `apt` install command paths, plus updated prompt-loop test stability.
- **Next steps**: Validate real installs manually on native Windows/Linux environments during release testing.

## Session 2: Consistent PDF Creation

- [x] (User written, not by AI) When creating the PDF again after changing the card images in the cards folder, sometimes the PDF does not update. Confirm if this is some issue regarding accessing the same images saved in memory. Updating the images and then recreating the PDF should reflect those changes.
- [x] (User written, not by AI) Add CLI command to skip the creation of a new PDF if one already exists. Add UI in the CLI to suggest recreating the PDF, even with this flag selected, if there are images in the cards folder newer than the creation date of the existing PDF.

### Context
- **Key files**: `src/pdf_maker.py`, `tests/test_desktop_tool.py`
- **Findings**: `fpdf` caches raster images by identifier; using file path identifiers can reuse stale image data. `PdfExporter.add_image` now feeds raw bytes for standard exports so cache keys track file content. Added regression test `test_pdf_exporter_add_image_uses_image_bytes`. Added CLI flag `--skip-pdf-if-exists` and helper logic to reuse existing export PDFs, prompt for recreation when `cards/` files are newer, and force regeneration for DriveThruCards if `_pdfx.pdf` output is missing.
- **Next steps**: Session 2 is complete. Continue with Session 3 Selenium login/bot-detection tasks.

## Session 3: Selenium Robustness

### Context
- **Key files**: `src/driver.py`, `src/webdrivers.py`, `src/constants.py`
- **Findings**:
  - Switched to `undetected-chromedriver` library for Cloudflare bypass (standard Selenium stealth measures were insufficient)
  - Added aggressive polling (500ms intervals) for Cloudflare challenge detection
  - Added auto-click attempt for Turnstile checkbox in iframe (fallback if challenge appears)
  - Fixed login modal selector to target correct link (`.modal a[href='/en/']`)
  - Removed `set_network_conditions` calls which were a potential detection vector
  - `undetected-chromedriver` requires `setuptools` on Python 3.13+ (distutils removed)
  - `undetected-chromedriver` auto-detection of Chrome version is broken; implemented `_detect_chrome_version()` to query browser directly
  - Cloudflare bypass now works
  - Added stealth JavaScript to `webdrivers.py` (`_apply_stealth_scripts`) to hide automation traces - this worked initially but login is now blocked again
  - Fixed slow response after Cloudflare by disabling implicit wait (5s) during polling methods
  - Removed unused visibility/focus workaround methods that caused jarring UX (minimize/restore window)
  - Added support for launching Chromium browsers with an existing user data directory/profile (`--browser-profile-path`, `--browser-profile-name`) so saved cookies/password managers can be reused for DriveThruCards login
  - Added tests to verify Chromium profile options are passed to `undetected-chromedriver` / Brave webdriver setup
  - Made custom stealth JavaScript injection opt-in (`--dtc-custom-stealth`) instead of always-on to reduce bot-detection surface area when using `undetected-chromedriver`
  - Added tests to verify custom stealth is disabled by default and only applied when explicitly enabled
  - Refactored `execute_drive_thru_cards_order` into explicit guarded steps with contextual failures and removed dead legacy upload path code
  - Added tests verifying DriveThruCards execution halts on login timeout and reports failing step names for easier debugging against UI changes
  - Moved noisy DriveThruCards Selenium step logs from `info` to `debug`, so average users get cleaner output while detailed traces remain available via `--log-level DEBUG`
  - Removed post-login pause by replacing longer `WebDriverWait` checks in publisher/setup navigation with fast polling and immediate direct-navigation fallback
  - Added browser-first sign-in instructions with `--skip-dtc-instructions` for experienced users
  - Separated ordinary account sign-in detection from publisher readiness detection
  - Automated non-exclusive publisher setup, including agreement acceptance and payment-default save; the visible Publish tab is the authoritative success check
- **Validation**: A full CLI run with a new Google-linked account and `/Users/bradley/Documents/dtc-test` created publisher access, uploaded the card PDF, and reached DriveThruCards checkout without purchasing.
- **Next steps**: Continue live DriveThruCards validation runs to tune selectors/timeouts as the site evolves.

### Testing Notes

**Important:** Always run the desktop tool itself for testing—do not spin up a separate browser instance. The first step in the Selenium automation chain is bypassing a Cloudflare captcha, which requires `undetected-chromedriver` and cannot be easily done with fresh browser instances.

**Test command:**
```bash
.venv/bin/python autofill.py --site drivethrucards --directory /Users/bradley/Documents/dtc-test
```

Always run this command yourself (via Bash tool) rather than prompting the user to run it. This allows you to capture output directly and debug issues more easily.

- [x] Improve Cloudflare CAPTCHA solver reliability
- [x] Fix slow response after Cloudflare CAPTCHA (disabled implicit wait during polling)
- [x] Fix login bot detection - stealth JavaScript approach inconsistent, site shows "Unable to log in"
- [x] Investigate using existing Chrome profile for cached credentials/password managers
- [x] Potentially overhaul Selenium automation due to new DriveThruCards UI
- [x] Automate creating a DriveThruCards non-exclusive publisher account when the Publish tab is absent
- [x] Reduce verbose Selenium step-by-step CLI output by default; keep detailed messages behind global log-level controls
- [x] Remove post-login delay before navigating to DriveThruCards publisher tools/setup flow

## Session 4: Test Coverage

- [x] Add testing coverage for all DriveThruCards unique actions

### Context
- **Key files**: `tests/test_drivethrucards_driver.py`, `src/driver.py`
- **Findings**: Added focused unit coverage for DriveThruCards-specific driver flow methods: execution sequencing, Cloudflare wait early-exit, login flow fallback behavior, ordinary-account detection, publisher setup, upload-page URL extraction, and site-load selector checks.
- **Next steps**: Expand integration-level Selenium tests against live DriveThruCards environments after bot-detection/login stability is further improved.

## Session 5: Documentation & Polish

- [x] Update README and GitHub Wiki for DriveThruCards CLI workflow and Ghostscript requirement
- [x] Consider adding CLI option to skip PDF recreation
- [x] Add CLI option to only download card images
- [x] Update bundler so Python executable incorporates assets under desktop-tool
- [x] Add CLI status updates during Ghostscript PDF processing (large orders appear to hang)
- [x] Update CLI UI to ask users to confirm Ghostscript installation as part of the DriveThruCards requirement flow
- [x] Add browser-first DriveThruCards sign-in instructions and a flag to suppress them

### Context
- **Key files**: `autofill.py`, `tests/test_desktop_tool.py`
- **Findings**: Added `--download-images-only` CLI option with `download_images_for_orders()` path that downloads fronts/backs and exits without launching webdriver/PDF export. Added tests for CLI flag visibility and download helper behavior. Added explicit PDF/X conversion progress logging (`Converting PDF to PDF/X-1a (n/total)`) and regression test to verify logs are emitted during conversion. Updated Nuitka directives to include the entire `assets/` directory and added a regression test to guard this packaging behavior. Updated `desktop-tool/readme.md` with DriveThruCards Ghostscript requirements and CLI workflow/flag documentation. Added a DriveThruCards-specific Ghostscript installation confirmation prompt before installation attempts and tests for this prompt path. Added a browser instruction page before DriveThruCards opens, plus `--skip-dtc-instructions` to bypass it.
- **Next steps**: All listed tasks are complete; continue monitoring DriveThruCards UI changes and adjust selectors/tests as needed.

## Session 6: CLI UX Improvements

- [x] Improve the base desktop tool CLI for the first few multiple-choice questions by replacing free-form typed input with a cleaner selection UI (for example: a selectable list/dropdown-style prompt).

### Context
- **Key files**: `autofill.py`, `tests/test_desktop_tool.py`
- **Findings**: Replaced no-args startup prompts for browser, site, auto-save, and image post-processing with InquirerPy `rawlist` prompts (number-jump + arrow-key navigation). Added `should_run_interactive_onboarding()` so this only runs for interactive no-argument launches, preserving existing flag-driven/non-interactive behavior.
- **Validation**: `.venv/bin/pytest -q tests/test_desktop_tool.py -k "interactive_onboarding or cli_site_choices_list_drivethrucards_last"` and `.venv/bin/pytest -q tests/test_desktop_tool.py -k "cli_help_documents_new_flags_and_stealth_guidance or cli_help_includes_global_log_level_option or cli_help_includes_download_images_only_option"` both passed.
- **Next steps**: Continue follow-up CLI-only UX work on branch `codex/cli-ui-overhaul`.

## Session 7: CLI UI Overhaul

- [x] Create dedicated branch for CLI-only UI/UX changes: `codex/cli-ui-overhaul`
- [ ] Separate interactive question prompts from background status/progress output so prompts are visually distinct.
- [ ] Rework progress bar lifecycle so completed bars do not obscure subsequent status messages.
- [ ] Standardize user-facing messaging for non-technical users (clear phase headers + concise action prompts).

## PR-Wide Final Audit

- [ ] Run a full post-PR code cleanup audit across all files changed in this DriveThruCards PR to remove redundancies, leftover scaffolding, and any loose/dead code from prior iterations.
- [ ] Prune low-value tests (especially documentation/help-text/existence-only assertions) and keep/add behavior-focused tests that validate real functionality.
