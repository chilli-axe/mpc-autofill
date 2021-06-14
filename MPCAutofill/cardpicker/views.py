import json

from django.http import JsonResponse
from django.shortcuts import redirect, render

from cardpicker.forms import InputCSV, InputText, InputXML
from cardpicker.models import Card, Cardback, Source, Token
from cardpicker.utils.mpcorder import Faces, MPCOrder, ReqTypes
from cardpicker.utils.search_functions import (
    build_context, query_es_card, query_es_cardback, query_es_token,
    search_new, search_new_elasticsearch_definition)
from cardpicker.utils.to_searchable import to_searchable


def index(request, error=False):
    return render(
        request,
        "cardpicker/index.html",
        {
            "form": InputText,
            "mobile": not request.user_agent.is_pc,
            "sources": [x.to_dict() for x in Source.objects.all()],
        },
    )


def guide(request):
    return render(request, "cardpicker/guide.html")


def new_cards(request):
    # serves the What's New page - this function returns the first page of results for all sources for
    # cards uploaded in the last two weeks

    s = search_new_elasticsearch_definition()
    results = {}
    for source in Source.objects.all():
        result = search_new(s, source.id)
        if result["qty"] > 0:
            results[source.id] = result

    return render(request, "cardpicker/new.html", {"sources": results})


def search_new_page(request):
    # triggers when the user clicks 'load more' on the What's New page
    # this function takes the current page number and source from the frontend and returns the next page
    # extract specified source and page from post request
    source = request.POST.get("source")
    page = int(request.POST.get("page"))

    s = search_new_elasticsearch_definition()
    results = {}
    result = search_new(s, source, page)
    if result["qty"] > 0:
        results[source] = result

    return JsonResponse({"sources": results}, safe=False)


def legal(request):
    return render(request, "cardpicker/legal.html")


def credits(request):
    sources = [x.to_dict() for x in Source.objects.all()]
    total_count = [x.objects.all().count() for x in [Card, Cardback, Token]]
    total_count.append(sum(total_count))
    total_count_f = [f"{x:,d}" for x in total_count]

    return render(
        request,
        "cardpicker/credits.html",
        {"sources": sources, "total_count": total_count_f},
    )


def search_multiple(request):
    # search endpoint function - the frontend requests the search results for this query as JSON
    drive_order = request.POST.get("drive_order").split(",")
    fuzzy_search = request.POST.get("fuzzy_search") == "true"
    order = MPCOrder()
    order.from_json(json.loads(request.POST.get("order")))

    for face in Faces.FACES.value:
        for item in order[face].values():
            result = search(drive_order, fuzzy_search, item.query, item.req_type)
            item.insert_data(result)
    result = search(drive_order, fuzzy_search, order.cardback.query, order.cardback.req_type)
    order.cardback.insert_data(result)
    return JsonResponse(order.to_dict())


def search_individual(request):
    # search endpoint function - the frontend requests the search results for this query as JSON
    drive_order = request.POST.get("drive_order").split(",")
    query = request.POST.get("query").rstrip("\n")
    req_type = request.POST.get("req_type")

    return JsonResponse(search(drive_order, query, req_type))


def search(drive_order, fuzzy_search, query, req_type):
    # this function can either receive a request with "normal" type with query like "t:goblin",
    # or a request with "token" type with query like "goblin", so handle both of those cases here
    if query.lower()[0:2] == "t:":
        query = query[2:]
        req_type = ReqTypes.TOKEN.value

    # now that we've potentially trimmed the query for tokens, convert the query to a searchable string
    query = to_searchable(query)

    # search for tokens if this request is for a token
    if req_type == ReqTypes.TOKEN.value:
        results = query_es_token(drive_order, fuzzy_search, query)

    # search for cardbacks if request is for cardbacks
    elif req_type == ReqTypes.CARDBACK.value:
        results = query_es_cardback()

    # otherwise, search normally
    else:
        results = query_es_card(drive_order, fuzzy_search, query)

    return {
        "data": results,
        "req_type": req_type,
        "query": query,
    }


def review(request):
    # return the review page with the order dict and quantity from parsing the given text input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputText(request.POST)
        if form.is_valid():
            # retrieve drive order and raw user input from request
            drive_order = list(request.POST.get("drive_order").split(","))
            fuzzy_search = request.POST.get("fuzzy_search") == "true"
            lines_raw = form["card_list"].value()

            # parse the text input to obtain the order dict and quantity in this order
            order = MPCOrder()
            qty = order.from_text(lines_raw)

            # build context
            context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

            return render(request, "cardpicker/review.html", context)

    return redirect("index")


def insert_text(request):
    # return a JSON response with the order dict and quantity from parsing the given input
    # used for inserting new cards into an existing order on the review page
    text = request.POST.get("text")
    offset = int(request.POST.get("offset"))

    # parse the text input to obtain the order dict and quantity in this addition to the order
    order = MPCOrder()
    qty = order.from_text(text, offset)

    # remove the "-" element from the common cardback slot list so the selected common cardback doesn't reset on us
    order.remove_common_cardback()

    # build context
    context = {
        "order": order.to_dict(),
        "qty": qty,
    }

    return JsonResponse(context)


def input_csv(request):
    # return the review page with the order dict and quantity from parsing the given CSV input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputCSV(request.POST, request.FILES)
        if form.is_valid():
            # retrieve drive order and csv file from request
            drive_order = list(request.POST.get("drive_order").split(","))
            fuzzy_search = request.POST.get("fuzzy_search") == "true"
            csvfile = request.FILES["file"].read()

            # parse the csv file to obtain the order dict and quantity in this order
            order = MPCOrder()
            qty = order.from_csv(csvfile)

            # build context
            context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

            return render(request, "cardpicker/review.html", context)

    return redirect("index")


def input_xml(request):
    # return the review page with the order dict and quantity from parsing the given XML input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputXML(request.POST, request.FILES)
        if form.is_valid():
            try:
                # retrieve drive order and XML file from request
                drive_order = list(request.POST.get("drive_order").split(","))
                fuzzy_search = request.POST.get("fuzzy_search") == "true"
                xmlfile = request.FILES["file"].read()

                # parse the XML file to obtain the order dict and quantity in this order
                order = MPCOrder()
                qty = order.from_xml(xmlfile, 0)

                # build context
                context = build_context(drive_order, fuzzy_search, order.to_dict(), qty)

                return render(request, "cardpicker/review.html", context)

            except IndexError:
                # IndexErrors can occur when trying to parse old XMLs that don't include the search query
                return redirect("index")

    return redirect("index")


def insert_xml(request):
    # return a JSON response with the order dict and quantity from parsing the given XML input
    # used for inserting new cards into an existing order on the review page
    xml = request.POST.get("xml")
    offset = int(request.POST.get("offset"))

    # parse the XML input to obtain the order dict and quantity in this addition to the order
    order = MPCOrder()
    qty = order.from_xml(xml, offset)

    # remove the - element from the common cardback slot list so the selected common cardback doesn't reset on us
    order.remove_common_cardback()

    # build context
    context = {
        "order": order.to_dict(),
        "qty": qty,
    }

    return JsonResponse(context)
