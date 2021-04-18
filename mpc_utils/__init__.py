import os, sys

from .mpc_om import XML_Order

class CURRDIR:
    """
    Singleton class for storing starting directory path
    """
    _instance = None
    _location = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def location(self):
        if self._location is None:
            self._location = os.path.dirname(
                os.path.realpath(sys.executable)
            ) if getattr(sys, 'frozen', False) else os.getcwd()
        return self._location

def currdir():
    return CURRDIR().location
