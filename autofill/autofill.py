import argparse

from driver import AutofillDriver
from utils import TEXT_BOLD, TEXT_END

command_line_argument_parser = argparse.ArgumentParser(description="MPC Autofill")
command_line_argument_parser.add_argument(
    "--skipsetup", action="store_true", default=False, help="Skip Setup"
)
command_line_args = command_line_argument_parser.parse_args()


if __name__ == "__main__":
    try:
        AutofillDriver().execute(command_line_args.skipsetup)
    except Exception as e:
        print(f"An uncaught exception occurred: {TEXT_BOLD}{e}{TEXT_END}")
        input("Press Enter to exit.")
