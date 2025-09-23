import logging
import os
from copy import copy

from src.formatting import TEXT_BOLD, TEXT_END

logger = logging.getLogger(__name__)


class FileLogFormatter(logging.Formatter):
    # A custom formatter which removes bold start/end characters from records before writing to disk
    def format(self, record: logging.LogRecord) -> str:
        new_record = copy(record)
        new_record.msg = new_record.msg.strip().replace(TEXT_BOLD, "").replace(TEXT_END, "")
        return super().format(new_record)


def configure_loggers(working_directory: str, log_debug_to_file: bool, stdout_log_level: int) -> None:
    logging.getLogger("googleapiclient").setLevel(logging.ERROR)
    logging.getLogger("oauth2client").setLevel(logging.ERROR)

    # All logs to files will be prefixed with log level and timestamp
    file_debug_format_string = "[%(levelname)s %(asctime)s] %(message)s"

    logging.raiseExceptions = False

    stdout_handler = logging.StreamHandler()
    stdout_handler.setLevel(stdout_log_level)
    if stdout_log_level <= logging.DEBUG:
        # If the user has opted into debug logging, format stdout logs with their log level
        console_debug_format_string = "[%(levelname)s] %(message)s"
        stdout_handler.setFormatter(logging.Formatter(console_debug_format_string))
    logger.addHandler(stdout_handler)

    file_crash_logger = logging.FileHandler(os.path.join(working_directory, "autofill_crash_log.txt"))
    file_crash_logger.setLevel(logging.ERROR)
    file_crash_logger.setFormatter(FileLogFormatter(file_debug_format_string))
    logger.addHandler(file_crash_logger)

    if log_debug_to_file:
        file_debug_logger = logging.FileHandler(os.path.join(working_directory, "autofill_log.txt"))
        file_debug_logger.setLevel(logging.DEBUG)
        file_debug_logger.setFormatter(FileLogFormatter(file_debug_format_string))
        logger.addHandler(file_debug_logger)

    logger.setLevel(level=logging.DEBUG)
