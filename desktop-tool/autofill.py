import os
import sys
from contextlib import nullcontext

import click
from wakepy import keepawake

from src.constants import Browsers
from src.driver import AutofillDriver
from src.pdf_maker import PdfExporter
from src.utils import TEXT_BOLD, TEXT_END

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal


@click.command()
@click.option(
    "--skipsetup",
    prompt="Skip project setup to continue editing an existing MPC project?" if len(sys.argv) == 1 else False,
    default=False,
    help=(
        "If this flag is passed, the tool will prompt the user to navigate to an existing MPC project "
        "and will attempt to align the state of the given project XML with the state of the project "
        "in MakePlayingCards. Note that this has some caveats - refer to the desktop-tool readme for details."
    ),
    is_flag=True,
)
@click.option(
    "-b",
    "--browser",
    prompt="Which web browser should the tool run on?" if len(sys.argv) == 1 else False,
    default=Browsers.chrome.name,
    type=click.Choice(sorted([browser.name for browser in Browsers]), case_sensitive=False),
    help="The web browser to run the tool on.",
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
def main(skipsetup: bool, browser: str, exportpdf: bool, allowsleep: bool) -> None:
    try:
        with keepawake(keep_screen_awake=True) if not allowsleep else nullcontext():
            if not allowsleep:
                print("System sleep is being prevented during this execution.")
            if exportpdf:
                PdfExporter().execute()
            else:
                AutofillDriver(browser=Browsers[browser]).execute(skipsetup)
    except Exception as e:
        print(f"An uncaught exception occurred: {TEXT_BOLD}{e}{TEXT_END}")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
