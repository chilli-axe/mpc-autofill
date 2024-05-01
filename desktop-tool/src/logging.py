import logging
from copy import copy

from src.utils import TEXT_BOLD, TEXT_END


class FileLogFormatter(logging.Formatter):
    # A custom formatter which removes bold start/end characters from records before writing to disk
    def format(self, record: logging.LogRecord) -> str:
        new_record = copy(record)
        new_record.msg = new_record.msg.strip().replace(TEXT_BOLD, "").replace(TEXT_END, "")
        return super().format(new_record)


class ConsoleLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno == logging.INFO


def configure_loggers(log_debug_to_file: bool) -> None:
    logging.getLogger("googleapiclient").setLevel(logging.ERROR)
    logging.getLogger("oauth2client").setLevel(logging.ERROR)

    # All logs to files will be prefixed with log level and timestamp
    format_string = "[%(levelname)s %(asctime)s] %(message)s"

    logger = logging.getLogger(name=None)  # none gets the root logger
    logging.raiseExceptions = False

    stdout_handler = logging.StreamHandler()
    stdout_handler.setLevel(logging.INFO)
    stdout_handler.addFilter(ConsoleLogFilter())
    logger.addHandler(stdout_handler)

    file_crash_logger = logging.FileHandler("autofill_crash_log.txt")
    file_crash_logger.setLevel(logging.ERROR)
    file_crash_logger.setFormatter(FileLogFormatter(format_string))
    logger.addHandler(file_crash_logger)

    if log_debug_to_file:
        file_debug_logger = logging.FileHandler("autofill_log.txt")
        file_debug_logger.setLevel(logging.DEBUG)
        file_debug_logger.setFormatter(FileLogFormatter(format_string))
        logger.addHandler(file_debug_logger)

    logger.setLevel(level=logging.DEBUG)
