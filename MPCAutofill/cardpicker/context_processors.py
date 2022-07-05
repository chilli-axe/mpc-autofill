from cardpicker.forms import InputLink, InputText
from cardpicker.utils.link_imports import ImportSites
from django.conf import settings


def add_site_info(request):
    return {
        "SITE_NAME": settings.SITE_NAME,
        "EMAIL": settings.TARGET_EMAIL,
        "DISCORD": settings.DISCORD,
        "REDDIT": settings.REDDIT,
        "THEME": settings.THEME,
        "GTAG": settings.GTAG,
    }


def common_info(request):
    return {
        "input_text_form": InputText,
        "input_link_form": InputLink,
        "mobile": not request.user_agent.is_pc,
        "import_sites": [(x.__name__, x().base_url) for x in ImportSites],
    }
