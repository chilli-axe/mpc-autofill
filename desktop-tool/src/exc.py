from src.utils import TEXT_BOLD, TEXT_END


class InvalidStateException(Exception):
    # TODO: recovery from invalid state?
    def __init__(self, state: str, expected_state: str):
        self.message = (
            f"Expected the driver to be in the state {TEXT_BOLD}{expected_state}{TEXT_END} but the driver is in the "
            f"state {TEXT_BOLD}{state}{TEXT_END}"
        )
        super().__init__(self.message)


class ValidationException(Exception):
    pass
