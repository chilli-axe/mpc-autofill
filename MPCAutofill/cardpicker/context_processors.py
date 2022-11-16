from typing import Any

from django.conf import settings
from django.http import HttpRequest

from cardpicker.forms import InputLink, InputText
from cardpicker.utils.link_imports import ImportSites


def add_site_info(request: HttpRequest) -> dict[str, Any]:
    return {
        "SITE_NAME": settings.SITE_NAME,
        "EMAIL": settings.TARGET_EMAIL,
        "DISCORD": settings.DISCORD,
        "REDDIT": settings.REDDIT,
        "THEME": settings.THEME,
        "GTAG": settings.GTAG,
    }


def common_info(request: HttpRequest) -> dict[str, Any]:
    return {
        "input_text_form": InputText,
        "input_link_form": InputLink,
        "mobile": not request.user_agent.is_pc,  # type: ignore
        "import_sites": [(x.__name__, x().get_base_url()) for x in ImportSites],
    }
