import argparse
import os

from src.driver import AutofillDriver
from src.utils import TEXT_BOLD, TEXT_END

# https://stackoverflow.com/questions/12492810/python-how-can-i-make-the-ansi-escape-codes-to-work-also-in-windows
os.system("")  # enables ansi escape characters in terminal

command_line_argument_parser = argparse.ArgumentParser(description="MPC Autofill")
command_line_argument_parser.add_argument("--skipsetup", action="store_true", default=False, help="Skip Setup")
command_line_args = command_line_argument_parser.parse_args()


def main():
    try:
        AutofillDriver().execute(command_line_args.skipsetup)
    except Exception as e:
        print(f"An uncaught exception occurred: {TEXT_BOLD}{e}{TEXT_END}")
        input("Press Enter to exit.")


if __name__ == "__main__":
    main()
