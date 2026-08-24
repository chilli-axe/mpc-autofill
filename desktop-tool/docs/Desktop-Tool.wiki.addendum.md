# Desktop Tool Wiki Addendum

Target page: <https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool>

These updates describe the DriveThruCards workflow in the `drivethrucards` branch. They can be copied into the wiki when PR [#367](https://github.com/chilli-axe/mpc-autofill/pull/367) is merged.

## Wiki Home

On the wiki Home page:

- Describe the desktop tool as preparing orders for supported card printers, including MakePlayingCards and DriveThruCards.
- Replace the Google Drive CI warning with:

> - GitHub Actions runs the backend and desktop tool test suites. Tests that need Google Drive credentials use the `GOOGLE_DRIVE_API_KEY` repository secret.
> - Pull requests from forks cannot access secrets stored in this repository. The desktop tool workflow still runs without the secret and skips only the credential-backed tests.
> - To run the complete desktop tool suite in your fork, add `GOOGLE_DRIVE_API_KEY` to the fork and run the workflow there. The secret's value is the full Google service-account JSON document, not a plain API key.

## GitHub Repo Configuration

Replace the `GOOGLE_DRIVE_API_KEY` description with:

> The full Google service-account JSON document, despite the historical name. Used by GitHub Actions for credential-backed backend and desktop tool tests, and built into the desktop tool binary. Pull requests from forks cannot read the upstream secret. The desktop workflow skips credential-backed tests when it is unavailable. Fork owners can add their own copy to run the complete suite in their fork.

## Overview

Replace the opening with:

> This tool ingests XML files generated with this project's web frontend, and:
>
> - Downloads the images in your order from Google Drive (into the directory `/cards` from the executable's location),
> - Uses Selenium (browser automation) for Chromium browsers to prepare an order with a supported card printer.
>
> For MakePlayingCards and PrinterStudio, the tool fills the site's card editor one image at a time. For DriveThruCards, it creates a print-ready PDF/X-1a file and uploads it through the publisher tools.
>
> Once the autofilling process completes, you can review and pay for your order. MakePlayingCards and PrinterStudio projects can also be saved to your account for later.
>
> **Note**: Automated Chromium browsers do not support signing in with Google accounts for security reasons. Create an account with the printing site directly and sign in with it.

## Running the Tool

Add this item after the current release download:

> - To use DriveThruCards before PR [#367](https://github.com/chilli-axe/mpc-autofill/pull/367) is merged, download the [latest DTC release](https://github.com/bwsinger/mpc-autofill/releases/latest). It includes Windows, Linux, Apple silicon Mac, and Intel Mac builds.

## DriveThruCards Automation

Add this section after "MakePlayingCards Automation":

> ### DriveThruCards Automation
>
> - The tool downloads the images in your order and creates a PDF for DriveThruCards' Premium Euro Poker size.
> - It converts the PDF to PDF/X-1a:2001 with [Ghostscript](https://ghostscript.com/) before opening the DriveThruCards publisher tools.
> - If your DriveThruCards account does not have publisher access, the tool completes the non-exclusive publisher setup.
> - You sign in yourself. The tool then creates the product, uploads the PDF, and opens the checkout page for your review. It never submits payment.
> - Each selected XML becomes one separate DriveThruCards product. DriveThruCards does not use the XML's
>   cardstock or foil settings, and the MPC order-combination option does not apply.
> - Multiple XML files use the same browser session and cart. The tool processes every selected XML automatically,
>   then pauses once for the final checkout handoff. Complete the purchase before closing the desktop tool.
>
> DriveThruCards requires Ghostscript. When it is missing, the tool asks before downloading a pinned, checksum-verified installer on macOS or Windows, or using apt, dnf, or yum on Linux. If you decline, install Ghostscript yourself and return to the prompt.
>
> For more consistent print colours, the tool looks for Adobe's US Web Coated (SWOP) ICC profile in the usual system folders and in `~/.mpc-autofill/`. If it cannot find the profile, it can download Adobe's end-user profile bundle, verify its SHA-256 checksum, and cache the profile. You can decline and continue with Ghostscript's default colour conversion.

## Specifying a Site to Autofill Into (`--site`)

Add DriveThruCards to the list of supported sites:

> - [DriveThruCards](https://www.drivethrucards.com)
>
> DriveThruCards uses Chrome or Brave. If you select another browser, the tool falls back to Chrome and tells you before continuing.

## PDF and Download Arguments

Replace "Exporting to PDF" with the following sections:

> ### Exporting to PDF (`--exportpdf`)
>
> Use `--exportpdf` to create PDF files without opening a browser or starting an order.
>
> With `--site DriveThruCards`, this creates the same PDF/X-1a file used by the automated DTC workflow, then exits. Ghostscript is still required.
>
> ### Downloading Images Only (`--download-images-only`)
>
> Use `--download-images-only` to download the card images into `cards/` and exit without creating a PDF or opening a browser.
>
> ### Reusing PDF Exports (`--skip-pdf-if-exists`)
>
> Use `--skip-pdf-if-exists` to reuse existing PDF exports. If an image in `cards/` is newer than the PDF, the tool asks whether to rebuild it. DriveThruCards orders only reuse an existing `_pdfx.pdf` file.

## DriveThruCards Arguments

Add these sections under "Command-Line Arguments":

> ### Reusing a Chromium Profile (`--browser-profile-path`, `--browser-profile-name`)
>
> Use `--browser-profile-path` to open DriveThruCards with an existing Chromium user data directory. This makes saved cookies and password managers available in the automated browser. Use `--browser-profile-name` to select a profile within that directory. The default profile name is `Default`.
>
> Close any regular browser windows using that profile before starting the tool. Chromium does not allow two browser processes to use the same profile at once.
>
> ### Skipping DriveThruCards Instructions (`--skip-dtc-instructions`)
>
> DriveThruCards normally opens a short instruction page before the sign-in page. Use `--skip-dtc-instructions` to open DriveThruCards immediately.
>
> ### Specifying a DriveThruCards ICC Profile (`--dtc-icc-profile`)
>
> Use `--dtc-icc-profile` to provide your own `.icc` profile for DriveThruCards PDF/X conversion. If you omit it, the tool looks for the US Web Coated (SWOP) profile or offers to download it from Adobe.

## Running the Test Suite

Replace the existing commands with:

> From the `desktop-tool` directory, run:
>
> ```shell
> pytest .
> ```
>
> On Linux, run the suite in a D-Bus session:
>
> ```shell
> dbus-run-session -- pytest .
> ```
>
> Tests that need Google Drive credentials skip themselves when `client_secrets.json` is not available.

## Building the Project

Replace the Nuitka build command's hyphen with a colon, then add:

> The dispatchable desktop build workflow produces one-file builds for Windows, Linux, Apple silicon Macs, and Intel Macs. Each build runs `--check-tls` and checks that `--help` lists both MakePlayingCards and DriveThruCards before GitHub stores the artifact.
