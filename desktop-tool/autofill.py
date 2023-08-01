import os
import sys
from contextlib import nullcontext
from typing import Optional

import click
from wakepy import keepawake

from src.constants import Browsers, ImageResizeMethods
from src.driver import AutofillDriver
from src.pdf_maker import PdfExporter
from src.processing import ImagePostProcessingConfig
from src.utils import TEXT_BOLD, TEXT_END

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal


@click.command(context_settings={"show_default": True})
@click.option(
    "--skipsetup",
    prompt="Skip project setup to continue editing an existing MPC project? (Press Enter if you're not sure.)"
    if len(sys.argv) == 1
    else False,
    default=False,
    help=(
        "If this flag is passed, the tool will prompt the user to navigate to an existing MPC project "
        "and will attempt to align the state of the given project XML with the state of the project "
        "in MakePlayingCards. Note that this has some caveats - refer to the wiki for details."
    ),
    is_flag=True,
)
@click.option(
    "--auto-save",
    prompt=(
        "Automatically save this project to your MakePlayingAccounts while the tool is running? "
        "(Press Enter if you're not sure.)"
    )
    if len(sys.argv) == 1
    else False,
    default=True,
    help=(
        "If this flag is passed, the tool will automatically save your project to your MakePlayingCards after "
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
    "-b",
    "--browser",
    prompt="Which web browser should the tool run on?  (Press Enter if you're not sure.)"
    if len(sys.argv) == 1
    else False,
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
    "--exportpdf",
    default=False,
    help="Create a PDF export of the card images instead of creating a project for MPC.",
    is_flag=True,
)
@click.option(
    "--allowsleep",
    default=False,
    help="Allows the system to fall asleep during execution.",
    is_flag=True,
)
@click.option(
    "--post-process-images",
    default=True,
    prompt=(
        "Should the tool post-process your images to reduce upload times? "
        "By default, images will be downscaled to 800 DPI. (Press Enter if you're not sure.)"
    )
    if len(sys.argv) == 1
    else False,
    help="Post-process images to reduce file upload time.",
    is_flag=True,
)
@click.option(
    "--max-dpi",
    default=800,
    type=click.IntRange(100, 1200),
    help="Images above this DPI will be downscaled to it before being uploaded to MPC.",
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
# @click.option(  # TODO: finish implementing jpeg conversion
#     "--convert-to-jpeg",
#     default=True,
#     type=click.BOOL,
#     help="If this flag is set, non-JPEG images will be converted to JPEG before being uploaded to MPC.",
#     is_flag=True,
# )
def main(
    skipsetup: bool,
    auto_save: bool,
    auto_save_threshold: int,
    browser: str,
    binary_location: Optional[str],
    exportpdf: bool,
    allowsleep: bool,
    post_process_images: bool,
    max_dpi: int,
    downscale_alg: str,
    # convert_to_jpeg: bool,
) -> None:
    try:
        with keepawake(keep_screen_awake=True) if not allowsleep else nullcontext():
            if not allowsleep:
                print("System sleep is being prevented during this execution.")
            if post_process_images:
                print("Images are being post-processed during this execution.")
            post_processing_config = (
                ImagePostProcessingConfig(max_dpi=max_dpi, downscale_alg=ImageResizeMethods[downscale_alg])
                if post_process_images
                else None
            )
            if exportpdf:
                PdfExporter().execute(post_processing_config=post_processing_config)
            else:
                AutofillDriver(browser=Browsers[browser], binary_location=binary_location).execute(
                    skip_setup=skipsetup, post_processing_config=post_processing_config
                )
    except Exception as e:
        print(f"An uncaught exception occurred:\n{TEXT_BOLD}{e}{TEXT_END}\n")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
