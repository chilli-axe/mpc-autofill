from django.conf import settings


def add_gtag(request):
    return {"GTAG": settings.GTAG}
