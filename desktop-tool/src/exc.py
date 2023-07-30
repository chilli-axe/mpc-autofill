from src.utils import bold


class InvalidStateException(Exception):
    # TODO: recovery from invalid state?
    def __init__(self, state: str, expected_state: str):
        self.message = (
            f"Expected the driver to be in the state {bold(expected_state)} but the driver is in the "
            f"state {bold(state)}"
        )
        super().__init__(self.message)


class ValidationException(Exception):
    pass
