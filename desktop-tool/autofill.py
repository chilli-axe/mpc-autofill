import logging
import os
import sys
from contextlib import nullcontext
from typing import Optional, Union

import click
from wakepy import keepawake

from src.constants import Browsers, ImageResizeMethods, TargetSites
from src.driver import AutofillDriver
from src.exc import ValidationException
from src.io import DEFAULT_WORKING_DIRECTORY, create_image_directory_if_not_exists
from src.logging import configure_loggers
from src.order import CardOrder, aggregate_and_split_orders
from src.pdf_maker import PdfExporter
from src.processing import ImagePostProcessingConfig
from src.utils import bold
from src.web_server import WebServer

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal


def prompt_if_no_arguments(prompt: str) -> Union[str, bool]:
    """
    We only prompt users to specify some flags if the tool was executed with no command-line arguments.
    """

    return f"{prompt} (Press Enter if you're not sure.)" if len(sys.argv) == 1 else False


@click.command(context_settings={"show_default": True})
@click.option("-d", "--directory", default=None, help=("The directory to search for order XML files."))
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
    help="Allows the system to fall asleep during execution.",
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
    "--combine-orders/--no-combine-orders",
    default=True,
    help="If True, compatible orders will be combined into a single order where possible.",
    is_flag=True,
)
@click.option(
    "--debug-logs/--no-debug-logs",
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
    combine_orders: bool,
    debug_logs: bool,
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
    create_image_directory_if_not_exists(working_directory=working_directory)

    if binary_location and not os.path.isdir(binary_location):
        raise Exception(
            f"Binary location was specified but is not a directory (or it doesn't exist): {bold(binary_location)}"
        )

    configure_loggers(working_directory=working_directory, log_debug_to_file=debug_logs)
    try:
        with keepawake(keep_screen_awake=True) if not allowsleep else nullcontext():
            if not allowsleep:
                logging.info("System sleep is being prevented during this execution.")
            if image_post_processing:
                logging.info("Images are being post-processed during this execution.")
            post_processing_config = (
                ImagePostProcessingConfig(max_dpi=max_dpi, downscale_alg=ImageResizeMethods[downscale_alg])
                if image_post_processing
                else None
            )
            if exportpdf:
                PdfExporter(order=CardOrder.from_xmls_in_folder(working_directory=working_directory)[0]).execute(
                    post_processing_config=post_processing_config
                )
            else:
                target_site = TargetSites[site]
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
        logging.exception("Uncaught exception")
        logging.info(f"An uncaught exception occurred:\n{bold(e)}\n")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
