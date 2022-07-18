from django.urls import path, re_path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("contributions", views.contributions, name="contributions"),
    path("new", views.new_cards, name="new"),
    path("legal", views.legal, name="legal"),
    re_path(r"^ajax/getnew/$", views.search_new_page, name="getnew"),
    re_path(r"^ajax/search/$", views.search_individual, name="search"),
    re_path(r"^ajax/msearch/$", views.search_multiple, name="msearch"),
    re_path(r"^ajax/text/$", views.insert_text, name="insert_text"),
    re_path(r"^ajax/xml/$", views.insert_xml, name="xml"),
    re_path(r"^ajax/link/$", views.insert_link, name="insert_link"),
    path("review", views.review, name="review"),
    path("guide", views.guide, name="guide"),
    path("input_xml", views.input_xml, name="input_xml"),
    path("input_csv", views.input_csv, name="input_csv"),
    path("input_link", views.input_link, name="input_link"),
]
