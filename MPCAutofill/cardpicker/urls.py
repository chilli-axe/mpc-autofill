from django.urls import path, re_path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("contributions", views.contributions, name="contributions"),
    path("patrons", views.patrons, name="patrons"),
    path("new", views.new_cards, name="new"),
    path("legal", views.legal, name="legal"),
    re_path(r"^ajax/getnew/$", views.search_new_page, name="getnew"),
    path("guide", views.guide, name="guide"),
    path("ajax/status/", views.elasticsearch_status, name="status"),
    # region old API
    re_path(r"^ajax/search/$", views.search_individual, name="search"),
    re_path(r"^ajax/msearch/$", views.search_multiple, name="msearch"),
    re_path(r"^ajax/text/$", views.insert_text, name="insert_text"),
    re_path(r"^ajax/xml/$", views.insert_xml, name="xml"),
    re_path(r"^ajax/link/$", views.insert_link, name="insert_link"),
    path("review", views.review, name="review"),
    path("input_xml", views.input_xml, name="input_xml"),
    path("input_csv", views.input_csv, name="input_csv"),
    path("input_link", views.input_link, name="input_link"),
    # endregion
    # region new API
    path("2/searchResults/", views.post_search_results),
    path("2/cards/", views.post_cards),
    path("2/sources/", views.get_sources),
    path("2/DFCPairs/", views.get_dfc_pairs),
    path("2/cardbacks/", views.get_cardbacks),
    path("2/importSites/", views.get_import_sites),
    path("2/importSiteDecklist/", views.post_import_site_decklist),
    path("2/sampleCards/", views.get_sample_cards),
    path("2/contributions/", views.get_contributions),
    path("2/info/", views.get_info),
    path("2/searchEngineHealth/", views.get_search_engine_health),
    # endregion
]
