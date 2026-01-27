# nuitka-project: --mode=onefile
# nuitka-project: --include-data-files=client_secrets.json=client_secrets.json
# nuitka-project: --include-data-files=post-launch.html=post-launch.html
# nuitka-project: --include-data-files=assets/icc/USWebCoatedSWOP.icc=assets/icc/USWebCoatedSWOP.icc
# nuitka-project: --include-data-files=assets/icc/Adobe-Color-Profile-EULA.pdf=assets/icc/Adobe-Color-Profile-EULA.pdf
# nuitka-project: --noinclude-pytest-mode=nofollow
# nuitka-project: --windows-icon-from-ico=favicon.ico
# nuitka-project-if: {OS} == "Windows":
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/macos/selenium-manager
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/linux/selenium-manager
# nuitka-project-if: {OS} == "Darwin":
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/windows/selenium-manager.exe
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/linux/selenium-manager
# nuitka-project-if: {OS} == "Linux":
#    nuitka-project: --include-module=wakepy._linux._jeepney_dbus
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/windows/selenium-manager.exe
#    nuitka-project: --noinclude-data-files=selenium/webdriver/common/macos/selenium-manager


import logging
import os
import shutil
import subprocess
import sys
from contextlib import nullcontext
from pathlib import Path
from typing import Optional, Union

import click
from wakepy import keepawake

from src.constants import Browsers, ImageResizeMethods, TargetSites
from src.driver import AutofillDriver
from src.exc import ValidationException
from src.formatting import bold
from src.io import DEFAULT_WORKING_DIRECTORY, create_image_directory_if_not_exists
from src.logging import configure_loggers, logger
from src.order import CardOrder, aggregate_and_split_orders
from src.pdf_maker import PdfExporter, PdfXConversionConfig, get_ghostscript_path, get_ghostscript_version
from src.processing import ImagePostProcessingConfig
from src.web_server import WebServer

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal


def prompt_if_no_arguments(prompt: str) -> Union[str, bool]:
    """
    We only prompt users to specify some flags if the tool was executed with no command-line arguments.
    """

    return f"{prompt} (Press Enter if you're not sure.)" if len(sys.argv) == 1 else False


def get_default_dtc_icc_profile() -> Optional[str]:
    if "__compiled__" in globals():
        candidate = Path(sys.argv[0]).resolve().parent / "assets/icc/USWebCoatedSWOP.icc"
    else:
        candidate = Path(__file__).resolve().parent / "assets/icc/USWebCoatedSWOP.icc"
    return str(candidate) if candidate.is_file() else None


def ensure_ghostscript_available() -> str:
    while True:
        gs_path = get_ghostscript_path()
        if gs_path:
            version = get_ghostscript_version(gs_path)
            if version:
                logger.info(f"Ghostscript detected: {bold(version)} at {bold(gs_path)}")
            else:
                logger.info(f"Ghostscript detected at {bold(gs_path)}")
            return gs_path

        logger.info(
            "DriveThruCards export requires Ghostscript for PDF/X-1a compliance."
        )

        should_install = click.confirm("Install Ghostscript now?", default=True)
        if should_install:
            if sys.platform.startswith("darwin"):
                if shutil.which("brew") is None:
                    logger.info("Homebrew not found. Please install Homebrew, then re-run.")
                else:
                    logger.info("Installing Ghostscript via Homebrew...")
                    result = subprocess.run(["brew", "install", "ghostscript"], check=False)
                    if result.returncode != 0:
                        logger.warning("Ghostscript installation via Homebrew failed.")
            elif sys.platform.startswith("win"):
                if shutil.which("winget") is None:
                    logger.info(
                        "winget not found. Please install Ghostscript from "
                        "https://ghostscript.com/releases/gsdnld.html and ensure it's on PATH."
                    )
                else:
                    logger.info("Installing Ghostscript via winget...")
                    result = subprocess.run(
                        ["winget", "install", "--id", "ArtifexSoftware.Ghostscript", "--accept-source-agreements"],
                        check=False,
                    )
                    if result.returncode != 0:
                        logger.warning("Ghostscript installation via winget failed.")
            else:
                if shutil.which("sudo") is None:
                    logger.info(
                        "sudo not found. Please install Ghostscript with your package manager manually."
                    )
                elif shutil.which("apt") is not None:
                    logger.info("Installing Ghostscript via apt...")
                    result = subprocess.run(["sudo", "apt", "install", "-y", "ghostscript"], check=False)
                    if result.returncode != 0:
                        logger.warning("Ghostscript installation via apt failed.")
                elif shutil.which("dnf") is not None:
                    logger.info("Installing Ghostscript via dnf...")
                    result = subprocess.run(["sudo", "dnf", "install", "-y", "ghostscript"], check=False)
                    if result.returncode != 0:
                        logger.warning("Ghostscript installation via dnf failed.")
                elif shutil.which("yum") is not None:
                    logger.info("Installing Ghostscript via yum...")
                    result = subprocess.run(["sudo", "yum", "install", "-y", "ghostscript"], check=False)
                    if result.returncode != 0:
                        logger.warning("Ghostscript installation via yum failed.")
                else:
                    logger.info("No supported package manager found. Please install Ghostscript manually.")
        else:
            logger.info(
                "Please install Ghostscript, then return here to continue.\n"
                "macOS: brew install ghostscript\n"
                "Windows: https://ghostscript.com/releases/gsdnld.html\n"
                "Linux: use your package manager (e.g., apt install ghostscript)."
            )

        input("Press Enter to re-check for Ghostscript, or Ctrl+C to exit.")


@click.command(context_settings={"show_default": True})
@click.option("-d", "--directory", default=None, help="The directory to search for order XML files.")
@click.option(
    "-b",
    "--browser",
    prompt=prompt_if_no_arguments("Which web browser should the tool run on?"),
    default=Browsers.chrome.name,
    type=click.Choice(sorted([browser.name for browser in Browsers]), case_sensitive=False),
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
    "--site",
    prompt=prompt_if_no_arguments("Which site should the tool auto-fill your project into?"),
    default=TargetSites.MakePlayingCards.name,
    type=click.Choice(sorted([site.name for site in TargetSites]), case_sensitive=False),
    help="The card printing site into which your order should be auto-filled.",
)
@click.option(
    "--auto-save/--no-auto-save",
    prompt=prompt_if_no_arguments("Automatically save this project to your account while the tool is running?"),
    default=True,
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
    "--allowsleep/--disallow-sleep",
    default=False,
    help="Controls whether the system is allowed to fall asleep during execution.",
    is_flag=True,
)
@click.option(
    "--image-post-processing/--no-image-post-processing",
    default=True,
    prompt=prompt_if_no_arguments(
        "Should the tool post-process your images to reduce upload times? "
        "By default, images will be downscaled to 800 DPI."
    ),
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
    help="Optional ICC profile path to embed in DriveThruCards exports.",
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
    help="Controls the level of logs written to standard output.",
)
@click.option(
    "--write-debug-logs",
    default=False,
    help="If True, debug logs about the tool's actions will be logged to autofill_log.txt in the tool's directory.",
    is_flag=True,
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
    site: str,
    exportpdf: bool,
    allowsleep: bool,
    image_post_processing: bool,
    max_dpi: int,
    downscale_alg: str,
    dtc_icc_profile: Optional[str],
    combine_orders: bool,
    log_level: str,
    write_debug_logs: bool,
    # convert_to_jpeg: bool,
) -> None:
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

    if binary_location and not os.path.isdir(binary_location):
        raise Exception(
            f"Binary location was specified but is not a directory (or it doesn't exist): {bold(binary_location)}"
        )

    configure_loggers(
        working_directory=working_directory,
        log_debug_to_file=write_debug_logs,
        stdout_log_level=logging.getLevelName(log_level),
    )
    try:
        with keepawake(keep_screen_awake=True) if not allowsleep else nullcontext():
            logger.info("MPC Autofill desktop tool has successfully initialised!")
            if not allowsleep:
                logger.info("System sleep is being prevented during this execution.")
            if image_post_processing:
                logger.info("Images are being post-processed during this execution.")
            target_site = TargetSites[site]
            post_processing_config = (
                ImagePostProcessingConfig(max_dpi=max_dpi, downscale_alg=ImageResizeMethods[downscale_alg])
                if image_post_processing
                else None
            )
            if target_site == TargetSites.DriveThruCards:
                ensure_ghostscript_available()
                using_default_icc = dtc_icc_profile is None
                resolved_icc_profile = dtc_icc_profile or get_default_dtc_icc_profile()
                if resolved_icc_profile is None:
                    raise Exception(
                        "Default DriveThruCards ICC profile was not found. "
                        "Ensure assets/icc/USWebCoatedSWOP.icc is available or pass --dtc-icc-profile."
                    )
                if resolved_icc_profile and not os.path.isfile(resolved_icc_profile):
                    raise Exception(
                        f"DriveThruCards ICC profile path does not exist or is not a file: {bold(resolved_icc_profile)}"
                    )
                icc_source = "bundled default" if using_default_icc else "user-provided"
                logger.info(f"DriveThruCards ICC profile ({icc_source}): {bold(resolved_icc_profile)}")
                # Keep images as RGB JPEG during PDF generation - fpdf can embed these directly
                # with DCT compression. Ghostscript will handle CMYK conversion with the ICC 
                # profile during PDF/X-1a conversion, which produces better results than 
                # pre-converting to CMYK (which fpdf re-encodes with FlateDecode, bloating file size).
                dtc_post_processing_config = ImagePostProcessingConfig(
                    max_dpi=300,
                    downscale_alg=ImageResizeMethods[downscale_alg],
                    output_format="JPEG",
                    convert_to_cmyk=False,  # Let Ghostscript handle CMYK conversion
                )
                orders = CardOrder.from_xmls_in_folder(working_directory=working_directory)
                for i, order in enumerate(orders, start=1):
                    exporter = PdfExporter(
                        order=order,
                        export_mode="drive_thru_cards",
                        pdfx_config=PdfXConversionConfig(icc_profile_path=resolved_icc_profile),
                    )
                    pdf_paths = exporter.execute(post_processing_config=dtc_post_processing_config)
                    dtc_pdf_path = next((path for path in reversed(pdf_paths) if path.endswith("_pdfx.pdf")), pdf_paths[0])
                    AutofillDriver(
                        browser=Browsers[browser],
                        target_site=target_site,
                        binary_location=binary_location,
                        starting_url=target_site.value.starting_url,
                    ).execute_drive_thru_cards_order(order=order, pdf_path=dtc_pdf_path)
                    if i < len(orders):
                        input(f"Press {bold('Enter')} to continue with the next DriveThruCards order.\n")
            elif exportpdf:
                PdfExporter(order=CardOrder.from_xmls_in_folder(working_directory=working_directory)[0]).execute(
                    post_processing_config=post_processing_config
                )
            else:
                card_orders = aggregate_and_split_orders(
                    orders=CardOrder.from_xmls_in_folder(working_directory=working_directory),
                    target_site=target_site,
                    combine_orders=combine_orders,
                )
                web_server = WebServer()
                AutofillDriver(
                    browser=Browsers[browser],
                    target_site=target_site,
                    binary_location=binary_location,
                    starting_url=web_server.server_url(),
                ).execute_orders(
                    orders=card_orders,
                    auto_save_threshold=auto_save_threshold if auto_save else None,
                    post_processing_config=post_processing_config,
                )
                input(
                    f"If this software has brought you joy and you'd like to throw a few bucks my way,\n"
                    f"you can find my tip jar here: {bold('https://www.buymeacoffee.com/chilli.axe')} Thank you!\n\n"
                    f"Press {bold('Enter')} to close this window - your browser window will remain open.\n"
                )
    except ValidationException as e:
        input(f"There was a problem with your order file:\n\n{bold(e)}\n\nPress Enter to exit.")
        sys.exit(0)
    except Exception as e:
        logger.exception("Uncaught exception")
        logger.info(f"An uncaught exception occurred:\n{bold(e)}\n")
        input("Press Enter to exit.")


if __name__ == "__main__":
    click.echo(
        "▙▗▌▛▀▖▞▀▖ ▞▀▖   ▐     ▗▀▖▗▜▜ \n"
        "▌▘▌▙▄▘▌   ▙▄▌▌ ▌▜▀ ▞▀▖▐  ▄▐▐ \n"
        "▌ ▌▌  ▌ ▖ ▌ ▌▌ ▌▐ ▖▌ ▌▜▀ ▐▐▐ \n"
        "▘ ▘▘  ▝▀  ▘ ▘▝▀▘ ▀ ▝▀ ▐  ▀▘▘▘\n"
    )
    main()
