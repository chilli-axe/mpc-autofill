import os
import sys
from contextlib import nullcontext

import click
from wakepy import keepawake

from src.constants import browsers
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
    help="Skip project setup to continue editing an existing MPC project.",
    is_flag=True,
)
@click.option(
    "-b",
    "--browser",
    prompt="Web browser to automate." if len(sys.argv) == 1 else False,
    default="chrome",
    type=click.Choice(sorted(browsers.keys()), case_sensitive=False),
    help="Web browser to automate.",
)
@click.option(
    "--exportpdf",
    default=False,
    help="Create a PDF export of the card images and do not create a project for MPC.",
    is_flag=True,
)
@click.option(
    "--allowsleep",
    default=False,
    help="Allows the system to fall alseep during execution",
    is_flag=True,
)
def main(skipsetup: bool, browser: str, exportpdf: bool, allowsleep: bool) -> None:
    try:
        with keepawake(keep_screen_awake=True) if not allowsleep else nullcontext():
            if not allowsleep:
                print("System sleep is being prevented during this execution")
            if exportpdf:
                PdfExporter().execute()
            else:
                AutofillDriver(driver_callable=browsers[browser]).execute(skipsetup)
    except Exception as e:
        print(f"An uncaught exception occurred: {TEXT_BOLD}{e}{TEXT_END}")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
