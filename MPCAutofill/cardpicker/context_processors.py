try:
    from ga_settings import GTAG
except ImportError:
    GTAG = ""


def add_gtag(request):
    return {"GTAG": GTAG}
