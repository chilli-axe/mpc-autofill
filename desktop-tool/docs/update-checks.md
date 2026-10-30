# Desktop release checks

Configured release builds ask on their first interactive run whether to check GitHub for updates.
The default is No. Choosing Yes checks the build's own repository for its latest stable release at each
interactive startup. When a newer version exists, the tool offers to open its GitHub release page, with Yes
as the default. Accepting stops the current run so you can download and replace the executable. Declining
continues your order. Downloads and
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
