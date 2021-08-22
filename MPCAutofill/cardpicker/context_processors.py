from django.conf import settings

from cardpicker.forms import InputLink, InputText
from cardpicker.utils.link_imports import ImportSites


def add_gtag(request):
    return {
        "GTAG": settings.GTAG,
    }


def common_info(request):
    return {
        "input_text_form": InputText,
        "input_link_form": InputLink,
        "mobile": not request.user_agent.is_pc,
        "import_sites": [(x.__name__, x().base_url) for x in ImportSites],
    }


def cache_version(request):
    return {"version": 3400}  # used to bust browser caches when the site updates
