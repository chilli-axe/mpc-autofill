import os

import click

from src.constants import browsers
from src.driver import AutofillDriver
from src.pdf_maker import PdfExporter
from src.utils import TEXT_BOLD, TEXT_END

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal


@click.command()
@click.option(
    "--skipsetup", default=False, help="Skip project setup to continue editing an existing MPC project.", is_flag=True
)
@click.option(
    "-b",
    "--browser",
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
    "-a",
    "--all",
    default=False,
    help="Create a saved project for each XML file found in the current folder.",
    is_flag=True,
)
@click.option(
    "-u",
    "--username"
)
@click.option(
    "-p",
    "--password"
)
def main(skipsetup: bool, browser: str, exportpdf: bool, all: bool, username: str, password: str) -> None:
    try:
        if exportpdf:
            PdfExporter().execute()
        else:
            if all is True:
                print(f"The XML files found in the current folder will be saved as {TEXT_BOLD}Saved Projects{TEXT_END} in your MPC account.")
                if username is None:
                    username = click.prompt("Enter your MPC username", type=str)
                if password is None:
                    password = click.prompt("Enter your MPC password", hide_input=True, type=str)
            AutofillDriver(driver_callable=browsers[browser], process_all_files=all, username=username, password=password).execute(skipsetup)
    except Exception as e:
        print(f"An uncaught exception occurred: {TEXT_BOLD}{e}{TEXT_END}")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
