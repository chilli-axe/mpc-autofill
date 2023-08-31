from django.urls import path

from . import views

urlpatterns = [
    path("2/searchResults/", views.post_search_results),
    path("2/cards/", views.post_cards),
    path("2/sources/", views.get_sources),
    path("2/DFCPairs/", views.get_dfc_pairs),
    path("2/languages/", views.get_languages),
    path("2/tags/", views.get_tags),
    path("2/cardbacks/", views.post_cardbacks),
    path("2/importSites/", views.get_import_sites),
    path("2/importSiteDecklist/", views.post_import_site_decklist),
    path("2/sampleCards/", views.get_sample_cards),
    path("2/contributions/", views.get_contributions),
    path("2/newCardsFirstPages/", views.get_new_cards_first_pages),
    path("2/newCardsPage/", views.get_new_cards_page),
    path("2/info/", views.get_info),
    path("2/searchEngineHealth/", views.get_search_engine_health),
]
