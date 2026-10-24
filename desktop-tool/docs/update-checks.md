# Desktop release checks

Configured release builds ask on their first interactive run whether to check GitHub for updates.
The default is No. Choosing Yes checks the build's own repository for its latest stable release at each
interactive startup. A newer version offers to open its GitHub release page; accepting stops the current
run so you can download and replace the executable. Declining continues your order. Downloads and
installation remain manual. Offline or rate-limited checks do not prevent normal use.

Consent is stored outside the executable and its extraction cache, so installing a newer build from the
same repository keeps checking enabled. Choosing No is also remembered. Moving from this fork to an
upstream build requires installing that build manually and consenting for its repository separately;
an existing fork executable continues checking this fork. Already released executables need a manual
upgrade to gain this feature.

`--check-updates` enables checking and `--no-check-updates` disables it, remembering the change.
These flags continue normal execution; when they are the only arguments, interactive setup still runs.
Ordinary runs without a terminal skip checks and prompts. An explicit `--check-updates` without a
terminal checks and prints a download link if newer, without opening a browser or asking questions.
`--help`, `--version`, and `--check-tls` do not check for updates or change consent.

Settings are JSON files in `update-checks/<owner>/<repository>.json` below Click's application settings directory:

- Windows: `%APPDATA%\mpc-autofill`
- macOS: `~/Library/Application Support/mpc-autofill`
- Linux: `$XDG_CONFIG_HOME/mpc-autofill`, defaulting to `~/.config/mpc-autofill`

Only a JSON boolean `enabled` value counts as a saved choice. Missing or damaged files ask again in an
interactive run. If a choice cannot be saved, it applies to the current run and a warning explains this.
The check sends an unauthenticated request to GitHub's public releases API with a three-second socket
timeout. It sends no order data. The link is constructed from the embedded repository and validated tag.

## Building a release

Both desktop build workflows require the release version and embed `github.repository`. Fork workflows
therefore check the fork automatically; an upstream build checks upstream without runtime code changes.
`--version` reports both values. The workflows assert them in the actual executables before uploading.

For a local build, after installing dependencies and providing `client_secrets.json`, run from `desktop-tool`:

```shell
python write_build_info.py --version 1.2.5 --repository bwsinger/mpc-autofill
python -m nuitka --file-version=1.2.5 --product-name=bwsinger-mpc-autofill-local-build-001 autofill.py
```

Use a **new product name for every different build**, including rebuilds of the same release. Extraction
caches use `{PRODUCT}-{VERSION}` to avoid overwriting a previously executed binary, which can trigger
macOS code-signature launch failures. CI includes the repository, run ID, attempt and platform in the name.
After a local build, restore `src/build_info.py` to its unconfigured source defaults before committing.
Unconfigured source runs skip the feature.

The version must match the numeric portion of the published tag: `1.2.5` for `dtc-v1.2.5`, or `4.7.0` for
`v4.7`. Stable tags with two to four numeric components are supported, with optional `v` or `dtc-v`
prefixes. Missing trailing components count as zero. These prefixes form one numeric release stream
within each repository. Unknown tag formats and prereleases are ignored; there are no cross-repository
version comparisons. Only GitHub's designated latest stable release is checked.

## Reviewed plan

The change was judged feasible as a small Python/Click feature, with no new dependency. Scope is startup,
saved consent, build identity, tests, documentation, and the two desktop build workflows.

1. Embed an explicit release version and repository before compilation; source defaults remain unconfigured.
2. Store strict boolean consent per repository in the platform's settings directory, using atomic replacement.
3. Check only with consent, after diagnostic early returns and before setup, directory creation or order work.
4. Compare stable numeric versions, show a trusted release link, and open it only after confirmation.
5. Test consent transitions, malformed state, headless execution, network failures, version ordering,
   browser failure and startup integration with temporary settings and fake responses.
6. Run desktop regressions and formatting checks, and compile a onefile metadata smoke test locally.

Two independent read-only plan reviews were completed before implementation:

- Startup/consent review: no blockers. Incorporated strict malformed-state tests, startup early-return
  checks, preserved setup for preference-only arguments, and standard-library networking.
- Builds/releases review: identified extraction-cache collisions as a blocker. Added a unique build product
  identity separate from the comparison version. Also incorporated exact bundled metadata assertions,
  migration documentation, and explicit headless preference transitions. Standard-library networking
  avoids Requests' implicit `.netrc` authentication.

Following the user's settings-location question, Click's existing platform-directory helper replaced
the initial home-dotfolder proposal. Preferences remain independent of executable location and version.

## Validation

On mserver (Linux, Python 3.13), the complete desktop suite passed: **241 passed, 30 skipped**.
This includes 77 focused update-check tests, local Chrome fixtures, and real Ghostscript PDF/X tests.
The skips were 27 credential-backed Google Drive tests and three live installer-download checks.
Black, isort, Ruff, YAML/Markdown formatting, whitespace checks, and strict mypy checks of the new
runtime/build modules passed.

A small Nuitka onefile executable compiled the release metadata and update-check module with the actual
cache directive. After moving the executable and making its source files unavailable, it still reported
the embedded version/repository, used the unique product/version cache, and wrote no settings in a
headless startup. A full desktop release executable and macOS/Windows builds were not compiled locally;
both release workflows now verify the metadata in their actual platform executables.
