# nuitka-project: --mode=onefile
# Each build extracts to its own cache directory: rewriting a previously-run executable
# in place invalidates macOS's cached code-signature and the OS kills the process with SIGKILL.
# Pass a unique --product-name per build and --file-version for the release version.
# nuitka-project: --onefile-tempdir-spec={CACHE_DIR}/mpc-autofill/{PRODUCT}-{VERSION}
# nuitka-project: --include-data-files=client_secrets.json=client_secrets.json
# nuitka-project: --include-data-files=post-launch.html=post-launch.html
# nuitka-project: --include-data-files=dtc-post-launch.html=dtc-post-launch.html
# nuitka-project: --include-data-dir=assets=assets
# nuitka-project: --include-package-data=certifi
# nuitka-project: --noinclude-pytest-mode=nofollow
# nuitka-project: --windows-icon-from-ico=favicon.ico
# nuitka-project-if: {OS} == "Windows":
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/macos/selenium-manager
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/linux/selenium-manager
# nuitka-project-if: {OS} == "Darwin":
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/windows/selenium-manager.exe
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/linux/selenium-manager
# nuitka-project-if: {OS} == "Linux":
#    nuitka-project: --include-module=wakepy.dbus_adapters.jeepney
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/windows/selenium-manager.exe
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/macos/selenium-manager

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
from contextlib import nullcontext
from copy import copy
from typing import TYPE_CHECKING, Optional

import certifi
import click
from click.core import ParameterSource

from src.build_info import RELEASE_REPOSITORY, VERSION
from src.constants import (
    DTC_POST_LAUNCH_HTML_FILENAME,
    Browsers,
    ImageResizeMethods,
    TargetSites,
)
from src.formatting import bold
from src.logging import logger
from src.update_check import check_for_updates

if TYPE_CHECKING:
    from src.order import CardOrder
    from src.pdf_maker import PdfXConversionConfig
    from src.processing import ImagePostProcessingConfig


def configure_tls() -> str:
    """Use the bundled CA bundle unless the user supplied one explicitly."""

    return os.environ.setdefault("SSL_CERT_FILE", certifi.where())


def prune_stale_onefile_caches(extraction_directory: str) -> None:
    """
    Each build extracts to its own directory under the mpc-autofill cache directory
    (see the --onefile-tempdir-spec build directive) - delete extractions left by old builds.
    """

    parent_directory = os.path.dirname(extraction_directory)
    if os.path.basename(parent_directory) != "mpc-autofill":
        return
    for entry in os.listdir(parent_directory):
        sibling = os.path.join(parent_directory, entry)
        if sibling != extraction_directory and os.path.isdir(sibling):
            shutil.rmtree(sibling, ignore_errors=True)


configure_tls()
if "__compiled__" in globals():
    prune_stale_onefile_caches(os.path.dirname(os.path.abspath(__file__)))

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
if sys.platform == "win32":
    os.system("")  # enables ansi escape characters in the Windows terminal

DEFAULT_BROWSER = Browsers.chrome.name
DEFAULT_SITE = TargetSites.MakePlayingCards.name
DEFAULT_AUTO_SAVE = True
DEFAULT_IMAGE_POST_PROCESSING = True
TLS_CHECK_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json"
GHOSTSCRIPT_DOWNLOAD_PAGE = "https://ghostscript.com/releases/gsdnld.html"
GHOSTSCRIPT_MACOS_DOWNLOAD_PAGE = "https://pages.uoregon.edu/koch/"
GHOSTSCRIPT_VERSION = "10.08.0"
GHOSTSCRIPT_MACOS_VERSION = "10.07.1"
GHOSTSCRIPT_RELEASE_TAG = f"gs{GHOSTSCRIPT_VERSION.replace('.', '')}"
GHOSTSCRIPT_WINDOWS_INSTALLERS = {
    "w32.exe": (
        f"https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/{GHOSTSCRIPT_RELEASE_TAG}/"
        f"{GHOSTSCRIPT_RELEASE_TAG}w32.exe",
        "42f9e97ea2580bc24e2604cc03a2213bdba6094869dbe9f8ede50f8dd86b7463",
    ),
    "w64.exe": (
        f"https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/{GHOSTSCRIPT_RELEASE_TAG}/"
        f"{GHOSTSCRIPT_RELEASE_TAG}w64.exe",
        "52a91b8bf09298788d7a57b9206127026c23eacd75405f0a131e26dc381dce50",
    ),
}
GHOSTSCRIPT_MACOS_INSTALLER = (
    f"{GHOSTSCRIPT_MACOS_DOWNLOAD_PAGE}Ghostscript-{GHOSTSCRIPT_MACOS_VERSION}.pkg",
    "7ea1d591c186b9f6f3e1d9cfd4ab2ef8570c5bcfd19b54086e8e183ed5892061",
)


def get_browser_picker_choices() -> list[str]:
    return sorted(browser.name for browser in Browsers)


def get_site_picker_choices() -> list[str]:
    return [site.name for site in TargetSites]


def should_run_interactive_onboarding() -> bool:
    return (
        all(argument in {"--check-updates", "--no-check-updates"} for argument in sys.argv[1:])
        and sys.stdin.isatty()
        and sys.stdout.isatty()
    )


def run_interactive_onboarding() -> tuple[str, str, bool, bool]:
    from InquirerPy import inquirer

    browser = inquirer.rawlist(
        message="Which web browser should the tool run on? (Press Enter if you're not sure.)",
        choices=get_browser_picker_choices(),
        default=DEFAULT_BROWSER,
    ).execute()
    site = inquirer.rawlist(
        message="Which site should the tool auto-fill your project into? (Press Enter if you're not sure.)",
        choices=get_site_picker_choices(),
        default=DEFAULT_SITE,
    ).execute()

    if site == TargetSites.DriveThruCards.name:
        return browser, site, True, False

    auto_save = inquirer.rawlist(
        message=(
            "Automatically save this project to your account while the tool is running? "
            "(Press Enter if you're not sure.)"
        ),
        choices=[{"name": "Yes", "value": True}, {"name": "No", "value": False}],
        default=DEFAULT_AUTO_SAVE,
    ).execute()
    image_post_processing = inquirer.rawlist(
        message=(
            "Should the tool post-process your images to reduce upload times? By default, images will be "
            "downscaled to 800 DPI. (Press Enter if you're not sure.)"
        ),
        choices=[{"name": "Yes", "value": True}, {"name": "No", "value": False}],
        default=DEFAULT_IMAGE_POST_PROCESSING,
    ).execute()
    return browser, site, auto_save, image_post_processing


def check_tls_connection() -> None:
    from urllib.request import urlopen

    with urlopen(TLS_CHECK_URL, timeout=30) as response:
        if response.status != 200:
            raise click.ClickException(f"TLS check returned HTTP {response.status}.")


def get_ghostscript_path(path: Optional[str] = None) -> Optional[str]:
    from src.pdf_maker import get_ghostscript_path as resolve_path

    return resolve_path(path)


def get_ghostscript_version(path: str) -> Optional[str]:
    from src.pdf_maker import get_ghostscript_version as resolve_version

    return resolve_version(path)


def wait_for_user_to_complete_order() -> None:
    input(
        f"If this software has brought you joy and you'd like to throw a few bucks my way,\n"
        f"you can find my tip jar here: {bold('https://www.buymeacoffee.com/chilli.axe')} Thank you!\n\n"
        f"Press {bold('Enter')} to close this window - your browser window will remain open.\n"
    )


def _download_ghostscript_installer(download_url: str, expected_digest: str, directory: str) -> str:
    import hashlib
    from urllib.request import Request, urlopen

    installer_path = os.path.join(directory, os.path.basename(download_url))
    download = Request(download_url, headers={"User-Agent": "mpc-autofill"})
    with urlopen(download, timeout=60) as response, open(installer_path, "wb") as installer:
        shutil.copyfileobj(response, installer)
    with open(installer_path, "rb") as installer:
        actual_digest = hashlib.file_digest(installer, "sha256").hexdigest()
    if actual_digest != expected_digest:
        raise RuntimeError("The downloaded Ghostscript installer failed checksum verification.")
    return installer_path


def _install_ghostscript_macos() -> bool:
    import tempfile

    download_url, expected_digest = GHOSTSCRIPT_MACOS_INSTALLER
    logger.info(f"Downloading the signed MacTeX Ghostscript {GHOSTSCRIPT_MACOS_VERSION} installer...")
    with tempfile.TemporaryDirectory() as directory:
        installer_path = _download_ghostscript_installer(download_url, expected_digest, directory)
        script = (
            "on run argv\n"
            'do shell script "/usr/sbin/installer -pkg " & quoted form of item 1 of argv & '
            '" -target /" with administrator privileges\n'
            "end run"
        )
        return subprocess.run(["/usr/bin/osascript", "-e", script, "--", installer_path], check=False).returncode == 0


def _install_ghostscript_windows() -> bool:
    import tempfile

    suffix = "w64.exe" if sys.maxsize > 2**32 else "w32.exe"
    download_url, expected_digest = GHOSTSCRIPT_WINDOWS_INSTALLERS[suffix]

    logger.info(f"Downloading Ghostscript {GHOSTSCRIPT_VERSION} from Artifex...")
    with tempfile.TemporaryDirectory() as directory:
        installer_path = _download_ghostscript_installer(download_url, expected_digest, directory)

        command = (
            "$process = Start-Process -FilePath $env:MPC_AUTOFILL_GS_INSTALLER "
            "-Verb RunAs -Wait -PassThru; exit $process.ExitCode"
        )
        environment = os.environ.copy()
        environment["MPC_AUTOFILL_GS_INSTALLER"] = installer_path
        return (
            subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                check=False,
                env=environment,
            ).returncode
            == 0
        )


def _install_ghostscript() -> bool:
    """
    Attempt to install Ghostscript, logging failures and returning whether the installer succeeded.
    """

    if sys.platform.startswith("darwin"):
        installer = _install_ghostscript_macos
        download_page = GHOSTSCRIPT_MACOS_DOWNLOAD_PAGE
    elif sys.platform.startswith("win"):
        installer = _install_ghostscript_windows
        download_page = GHOSTSCRIPT_DOWNLOAD_PAGE
    else:
        package_manager = next(
            (candidate for candidate in ["apt", "dnf", "yum"] if shutil.which(candidate) is not None), None
        )
        if shutil.which("sudo") is None:
            logger.info("sudo not found. Please install Ghostscript with your package manager manually.")
            return False
        elif package_manager is None:
            logger.info("No supported package manager found. Please install Ghostscript manually.")
            return False
        else:
            logger.info(f"Installing Ghostscript via {package_manager}...")
            result = subprocess.run(["sudo", package_manager, "install", "-y", "ghostscript"], check=False)
            if result.returncode != 0:
                logger.warning(f"Ghostscript installation via {package_manager} failed.")
            return result.returncode == 0

    try:
        if installer():
            return True
    except Exception as error:
        logger.warning(f"Ghostscript installation failed: {error}")
    logger.info(f"Please install Ghostscript from {download_page}.")
    return False


def ensure_ghostscript_available() -> str:
    """Select a supported executable, with at most one consented installation attempt."""
    from src.pdf_maker import is_ghostscript_version_supported

    installation_attempted = False
    while True:
        gs_path = get_ghostscript_path()
        version = get_ghostscript_version(gs_path) if gs_path else None
        if gs_path and is_ghostscript_version_supported(version):
            logger.info(f"Ghostscript detected: {bold(version)} at {bold(gs_path)}")
            return gs_path

        message = (
            f"DriveThruCards requires Ghostscript 10.05 or newer; found {version or 'no readable version'} "
            f"at {gs_path or 'no executable'}. Upgrade Ghostscript and check your PATH. "
            f"Downloads: {GHOSTSCRIPT_DOWNLOAD_PAGE}"
        )
        if installation_attempted:
            raise click.ClickException(message)
        logger.warning(message)
        if click.confirm("Is it okay if MPC Autofill tries to install Ghostscript now?", default=True):
            installation_attempted = True
            _install_ghostscript()
            continue

        logger.info(
            "Please install Ghostscript, then return here to continue.\n"
            f"macOS: {GHOSTSCRIPT_MACOS_DOWNLOAD_PAGE}\n"
            f"Windows: {GHOSTSCRIPT_DOWNLOAD_PAGE}\n"
            "Linux: use your package manager (e.g., apt install ghostscript)."
        )
        input("Press Enter to re-check for Ghostscript, or Ctrl+C to exit.")


def export_pdf_order(
    order: CardOrder,
    skip_pdf_if_exists: bool,
    post_processing_config: Optional[ImagePostProcessingConfig],
    pdfx_config: Optional[PdfXConversionConfig] = None,
) -> list[str]:
    from src.pdf_cache import reuse_pdf_export, save_pdf_export
    from src.pdf_maker import PdfExporter

    post_processing_config = copy(post_processing_config)
    export_mode = "drive_thru_cards" if pdfx_config else "standard"
    gs_path = get_ghostscript_path(pdfx_config.ghostscript_path) if pdfx_config else None
    settings = repr(
        (export_mode, post_processing_config, pdfx_config, get_ghostscript_version(gs_path) if gs_path else None)
    )
    extra_paths = [pdfx_config.icc_profile_path] if pdfx_config and pdfx_config.icc_profile_path else []
    if skip_pdf_if_exists:
        paths = reuse_pdf_export(order, settings, extra_paths)
        if paths and (not pdfx_config or sum(path.endswith("_pdfx.pdf") for path in paths) == 1):
            return paths
        logger.info("No matching PDF export found. Rebuilding from the current order and images.")

    exporter = PdfExporter(order=order, export_mode=export_mode, pdfx_config=pdfx_config)
    paths = exporter.execute(post_processing_config=post_processing_config)
    if pdfx_config and sum(path.endswith("_pdfx.pdf") for path in paths) != 1:
        raise ValueError("DriveThruCards export did not produce exactly one PDF/X-1a file. Cannot upload this order.")
    if exporter.input_fingerprint is not None:
        save_pdf_export(order, settings, extra_paths, paths, expected_fingerprint=exporter.input_fingerprint)
    return paths


def download_images_for_orders(
    orders: list[CardOrder],
    post_processing_config: Optional[ImagePostProcessingConfig],
) -> None:
    from concurrent.futures import ThreadPoolExecutor

    import enlighten

    from src.constants import THREADS
    from src.exc import ImageDownloadError

    total_images = sum(len(order.fronts.cards_by_id) + len(order.backs.cards_by_id) for order in orders)
    manager = enlighten.get_manager()
    download_bar = manager.counter(
        total=total_images, desc="Images Downloaded", position=1, autorefresh=True, leave=False
    )
    try:
        with ThreadPoolExecutor(max_workers=THREADS) as pool:
            for order in orders:
                logger.info(f"Downloading images for {bold(order.name or 'Unnamed Project')}...")
                order.fronts.download_images(pool, download_bar, post_processing_config)
                order.backs.download_images(pool, download_bar, post_processing_config)
    finally:
        download_bar.close(clear=True)
        manager.stop()
    failed_images = sorted({failed for order in orders for failed in order.get_failed_downloads()})
    if failed_images:
        raise ImageDownloadError(failed_images)
    logger.info("Finished downloading card images.")


def get_dtc_pdf_paths_for_order(
    order: CardOrder,
    skip_pdf_if_exists: bool,
    resolved_icc_profile: Optional[str],
    downscale_alg: str,
    ghostscript_path: Optional[str] = None,
) -> list[str]:
    from src.pdf_maker import PdfXConversionConfig
    from src.processing import ImagePostProcessingConfig

    return export_pdf_order(
        order=order,
        skip_pdf_if_exists=skip_pdf_if_exists,
        post_processing_config=ImagePostProcessingConfig(
            max_dpi=300, downscale_alg=ImageResizeMethods[downscale_alg], output_format="JPEG"
        ),
        pdfx_config=PdfXConversionConfig(icc_profile_path=resolved_icc_profile, ghostscript_path=ghostscript_path),
    )


@click.command(context_settings={"show_default": True})
@click.version_option(
    VERSION or "development",
    prog_name="MPC Autofill",
    message=f"%(prog)s %(version)s ({RELEASE_REPOSITORY or 'unconfigured'})",
)
@click.option("-d", "--directory", default=None, help="The directory to search for order XML files.")
@click.option(
    "-b",
    "--browser",
    default=DEFAULT_BROWSER,
    type=click.Choice(get_browser_picker_choices(), case_sensitive=False),
    help="The web browser to run the tool on.",
)
@click.option(
    "--binary-location",
    default=None,
    help=(
        "The file path to your browser's binary (executable). "
        "You only need to specify this if you have installed your browser of choice but the tool is unable "
        "to locate it at startup. This is most likely to occur if using the Brave browser."
    ),
)
@click.option(
    "--browser-profile-path",
    default=None,
    help=(
        "Optional Chromium user-data directory for reusing existing profiles, cookies, and password managers "
        "when targeting DriveThruCards. Example on macOS: ~/Library/Application Support/Google/Chrome"
    ),
)
@click.option(
    "--browser-profile-name",
    default="Default",
    help="Profile directory name inside --browser-profile-path (e.g. Default or 'Profile 1').",
)
@click.option(
    "--skip-dtc-instructions",
    default=False,
    help="Open DriveThruCards immediately without showing the browser instruction page.",
    is_flag=True,
)
@click.option(
    "--site",
    default=DEFAULT_SITE,
    type=click.Choice(get_site_picker_choices(), case_sensitive=False),
    help="The card printing site into which your order should be auto-filled.",
)
@click.option(
    "--auto-save/--no-auto-save",
    default=DEFAULT_AUTO_SAVE,
    help=(
        "If this flag is passed, the tool will automatically save your project to your account after "
        "processing each batch of cards."
    ),
    is_flag=True,
)
@click.option(
    "--auto-save-threshold",
    type=click.IntRange(1, None),
    default=5,
    help="Controls how often the project should be saved in terms of the number of cards uploaded.",
)
@click.option(
    "--exportpdf",
    default=False,
    help="Create a PDF export of the card images instead of creating a project with a printing site.",
    is_flag=True,
)
@click.option(
    "--download-images-only",
    default=False,
    help="Download card images to cards/ and exit (skip PDF creation and browser automation).",
    is_flag=True,
)
@click.option(
    "--skip-pdf-if-exists/--no-skip-pdf-if-exists",
    default=True,
    help=(
        "Reuse exported PDFs when the order, image contents and export settings match. "
        "Use --no-skip-pdf-if-exists to rebuild or choose a different standard PDF layout."
    ),
    is_flag=True,
)
@click.option(
    "--allowsleep/--disallow-sleep",
    default=False,
    help="Controls whether the system is allowed to fall asleep during execution.",
    is_flag=True,
)
@click.option(
    "--image-post-processing/--no-image-post-processing",
    default=DEFAULT_IMAGE_POST_PROCESSING,
    help="Post-process images to reduce file upload time.",
    is_flag=True,
)
@click.option(
    "--max-dpi",
    default=800,
    type=click.IntRange(100, 1200),
    help="Images above this DPI will be downscaled to it before being uploaded to the targeted site.",
)
@click.option(
    "--downscale-alg",
    default=ImageResizeMethods.LANCZOS.name,
    type=click.Choice(sorted([str(x.name) for x in ImageResizeMethods])),
    help=(
        "The algorithm used when downscaling images to the max DPI. "
        "See the link below for a performance comparison of each option: "
        "\nhttps://pillow.readthedocs.io/en/latest/handbook/concepts.html#filters-comparison-table"
    ),
)
@click.option(
    "--dtc-icc-profile",
    default=None,
    help=(
        "Optional ICC profile path for DriveThruCards PDF/X conversion "
        "(by default, an installed US Web Coated (SWOP) profile is located or downloaded from Adobe)."
    ),
)
@click.option(
    "--combine-orders/--no-combine-orders",
    default=True,
    help="If True, compatible orders will be combined into a single order where possible.",
    is_flag=True,
)
@click.option(
    "--log-level",
    default=logging.getLevelName(logging.INFO),
    type=click.Choice(
        [
            logging.getLevelName(logging.CRITICAL),
            logging.getLevelName(logging.FATAL),
            logging.getLevelName(logging.ERROR),
            logging.getLevelName(logging.WARNING),
            logging.getLevelName(logging.WARN),
            logging.getLevelName(logging.INFO),
            logging.getLevelName(logging.DEBUG),
            logging.getLevelName(logging.NOTSET),
        ]
    ),
    help="Global CLI output verbosity. Use DEBUG to show detailed Selenium step-by-step logs.",
)
@click.option(
    "--write-debug-logs",
    default=False,
    help="If True, debug logs about the tool's actions will be logged to autofill_log.txt in the tool's directory.",
    is_flag=True,
)
@click.option("--check-tls", is_flag=True, hidden=True)
@click.option(
    "--check-updates/--no-check-updates",
    default=None,
    help="Remember whether to check this build's GitHub repository for newer releases on startup.",
)
# @click.option(  # TODO: finish implementing jpeg conversion
#     "--convert-to-jpeg",
#     default=True,
#     type=click.BOOL,
#     help="If this flag is set, non-JPEG images will be converted to JPEG before being uploaded to the targeted site.",
#     is_flag=True,
# )
def main(
    auto_save: bool,
    auto_save_threshold: int,
    browser: str,
    directory: Optional[str],
    binary_location: Optional[str],
    browser_profile_path: Optional[str],
    browser_profile_name: str,
    skip_dtc_instructions: bool,
    site: str,
    exportpdf: bool,
    download_images_only: bool,
    skip_pdf_if_exists: bool,
    allowsleep: bool,
    image_post_processing: bool,
    max_dpi: int,
    downscale_alg: str,
    dtc_icc_profile: Optional[str],
    combine_orders: bool,
    log_level: str,
    write_debug_logs: bool,
    check_tls: bool,
    check_updates: Optional[bool],
    # convert_to_jpeg: bool,
) -> None:
    if check_tls:
        check_tls_connection()
        click.echo("TLS check succeeded.")
        return

    if check_for_updates(check_updates):
        return

    if should_run_interactive_onboarding():
        browser, site, auto_save, image_post_processing = run_interactive_onboarding()

    from wakepy import keep

    from src.exc import ImageDownloadError, ValidationException
    from src.io import DEFAULT_WORKING_DIRECTORY, create_image_directory_if_not_exists
    from src.logging import configure_loggers
    from src.order import CardOrder, aggregate_and_split_orders
    from src.processing import ImagePostProcessingConfig

    working_directory: str = DEFAULT_WORKING_DIRECTORY
    if directory:
        if not os.path.isdir(directory):
            raise Exception(
                "Working directory was specified but is not a directory (or it doesn't exist): "
                f"{bold(working_directory)}"
            )
        working_directory = directory
    os.chdir(working_directory)
    create_image_directory_if_not_exists(working_directory=working_directory)

    if binary_location and not os.path.isfile(binary_location):
        raise Exception(
            f"Binary location was specified but is not a file (or it doesn't exist): {bold(binary_location)}"
        )
    if browser_profile_path and not os.path.isdir(browser_profile_path):
        raise Exception(
            "Browser profile path was specified but is not a directory (or it doesn't exist): "
            f"{bold(browser_profile_path)}"
        )

    configure_loggers(
        working_directory=working_directory,
        log_debug_to_file=write_debug_logs,
        stdout_log_level=logging.getLevelName(log_level),
    )
    if TargetSites[site] == TargetSites.DriveThruCards:
        explicit = click.get_current_context().get_parameter_source
        if not auto_save and explicit("auto_save") == ParameterSource.COMMANDLINE:
            logger.info("Ignoring --no-auto-save: DriveThruCards orders are always saved to your account.")
        if image_post_processing and explicit("image_post_processing") == ParameterSource.COMMANDLINE:
            logger.info(
                "Ignoring --image-post-processing: DriveThruCards images are already downscaled once "
                "during PDF creation."
            )
        if explicit("combine_orders") == ParameterSource.COMMANDLINE:
            logger.info(
                "Ignoring --combine-orders/--no-combine-orders: "
                "each DriveThruCards XML is always created as a separate product."
            )
        auto_save = True
        image_post_processing = False
    try:
        with keep.presenting(on_fail="warn") if not allowsleep else nullcontext() as sleep_mode:
            logger.info("MPC Autofill desktop tool has successfully initialised!")
            if sleep_mode is not None and sleep_mode.active:
                logger.info("System sleep is being prevented during this execution.")
            elif not allowsleep:
                logger.warning("Sleep prevention is unavailable. Your system may sleep during this execution.")
            if image_post_processing:
                logger.info("Images are being post-processed during this execution.")
            target_site = TargetSites[site]
            post_processing_config = (
                ImagePostProcessingConfig(max_dpi=max_dpi, downscale_alg=ImageResizeMethods[downscale_alg])
                if image_post_processing
                else None
            )
            if download_images_only:
                orders = CardOrder.from_xmls_in_folder(
                    working_directory=working_directory,
                    validate_print_options=target_site != TargetSites.DriveThruCards,
                )
                download_images_for_orders(orders=orders, post_processing_config=post_processing_config)
                return
            if target_site == TargetSites.DriveThruCards:
                from src.driver import AutofillDriver
                from src.icc import find_or_download_dtc_icc_profile
                from src.web_server import WebServer

                ghostscript_path = ensure_ghostscript_available()
                if dtc_icc_profile and not os.path.isfile(dtc_icc_profile):
                    raise Exception(
                        f"DriveThruCards ICC profile path does not exist or is not a file: {bold(dtc_icc_profile)}"
                    )
                resolved_icc_profile = dtc_icc_profile or find_or_download_dtc_icc_profile()
                if resolved_icc_profile is None:
                    logger.warning(
                        "No ICC profile is available - Ghostscript's default CMYK conversion will be used "
                        "instead. Print colours may differ from previous orders."
                    )
                else:
                    logger.info(f"DriveThruCards ICC profile: {bold(resolved_icc_profile)}")
                orders = CardOrder.from_xmls_in_folder(
                    working_directory=working_directory,
                    validate_print_options=False,
                )
                dtc_driver: Optional[AutofillDriver] = None
                dtc_web_server: Optional[WebServer] = None
                for order in orders:
                    pdf_paths = get_dtc_pdf_paths_for_order(
                        order=order,
                        skip_pdf_if_exists=skip_pdf_if_exists,
                        resolved_icc_profile=resolved_icc_profile,
                        downscale_alg=downscale_alg,
                        ghostscript_path=ghostscript_path,
                    )
                    # Only use the Ghostscript PDF/X-1a output - no fallback
                    dtc_pdf_paths = [path for path in pdf_paths if path.endswith("_pdfx.pdf")]
                    if len(dtc_pdf_paths) != 1:
                        raise Exception(
                            "DriveThruCards requires exactly one PDF/X-1a file per order. "
                            "Recreate the PDF export before uploading."
                        )
                    if exportpdf:
                        continue
                    dtc_pdf_path = dtc_pdf_paths[0]
                    if dtc_driver is None:
                        starting_url = target_site.value.starting_url
                        if not skip_dtc_instructions:
                            logger.info(
                                "DriveThruCards setup will open in your browser. " "Follow the instructions there."
                            )
                            dtc_web_server = WebServer(DTC_POST_LAUNCH_HTML_FILENAME)
                            starting_url = dtc_web_server.server_url()
                        dtc_driver = AutofillDriver(
                            browser=Browsers[browser],
                            target_site=target_site,
                            binary_location=binary_location,
                            browser_profile_path=browser_profile_path,
                            browser_profile_name=browser_profile_name if browser_profile_path else None,
                            starting_url=starting_url,
                        )
                        dtc_driver.prepare_drive_thru_cards_session()
                    dtc_driver.execute_drive_thru_cards_order(order=order, pdf_path=dtc_pdf_path)
                if dtc_driver is not None:
                    logger.info(
                        "All DriveThruCards product setups are complete. "
                        "Please check that your cart contains every intended product before completing the purchase manually."
                    )
                    input(f"Complete your purchase in the browser, then press {bold('Enter')} to close this window.\n")
            elif exportpdf:
                order = CardOrder.from_xmls_in_folder(working_directory=working_directory)[0]
                export_pdf_order(order, skip_pdf_if_exists, post_processing_config)
            else:
                from src.driver import AutofillDriver
                from src.web_server import WebServer

                card_orders = aggregate_and_split_orders(
                    orders=CardOrder.from_xmls_in_folder(working_directory=working_directory),
                    target_site=target_site,
                    combine_orders=combine_orders,
                )
                web_server = WebServer()
                autofill_driver = AutofillDriver(
                    browser=Browsers[browser],
                    target_site=target_site,
                    binary_location=binary_location,
                    browser_profile_path=browser_profile_path,
                    browser_profile_name=browser_profile_name if browser_profile_path else None,
                    starting_url=web_server.server_url(),
                )
                autofill_driver.execute_orders(
                    orders=card_orders,
                    auto_save_threshold=auto_save_threshold if auto_save else None,
                    post_processing_config=post_processing_config,
                )
                wait_for_user_to_complete_order()
    except ImageDownloadError as e:
        logger.error(str(e))
        input("Press Enter to exit.")
    except ValidationException as e:
        input(f"There was a problem with your order file:\n\n{bold(e)}\n\nPress Enter to exit.")
        sys.exit(0)
    except Exception as e:
        logger.exception("Uncaught exception")
        logger.info(f"An uncaught exception occurred:\n{bold(e)}\n")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
