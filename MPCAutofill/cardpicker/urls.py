from django.urls import path, re_path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('guide', views.guide, name='guide'),
    path('credits', views.credits, name='credits'),
    path('legal', views.legal, name='legal'),

    re_path(r'^ajax/search/$', views.search, name='search'),

    re_path(r'^ajax/text/$', views.insert_text, name='insert_text'),
    re_path(r'^ajax/xml/$', views.insert_xml, name='xml'),

    path('review', views.review, name='review'),
    path('input_xml', views.input_xml, name='input_xml'),
    path('input_csv', views.input_csv, name='input_csv'),
]
