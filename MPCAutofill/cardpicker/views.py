from django.http import JsonResponse
from django.shortcuts import render, redirect

from search_functions import \
    build_context, \
    parse_text, \
    parse_xml, \
    parse_csv, \
    query_es_cardback, \
    query_es_card, \
    query_es_token
from to_searchable import to_searchable
from .forms import InputText, InputXML, InputCSV
from .models import Card, Cardback, Token, Source


def index(request, error=False):
    sources = {}
    for source in Source.objects.all():
        if "sources" not in source.id:
            sources[source.id] = {'username': source.username,
                                  'reddit': source.reddit,
                                  'drivelink': source.drivelink}

    context = {'form': InputText,
               'mobile': not request.user_agent.is_pc,
               'sources': sources}

    return render(request, 'cardpicker/index.html', context)


def guide(request):
    return render(request, 'cardpicker/guide.html')


def legal(request):
    return render(request, 'cardpicker/legal.html')


def credits(request):
    # count how many cards are in the database and format with commas
    total_count = [x.objects.all().count() for x in [Card, Cardback, Token]]
    total_count.append(sum(total_count))
    total_count_f = [f"{x:,d}" for x in total_count]

    # retrieve all source objects and build context
    sources = Source.objects.all()
    context = {x.id: x for x in sources}

    # but also format quantities with commas
    for source in sources:
        context[source.id].qty_cards = f"{context[source.id].qty_cards :,d}"
        context[source.id].qty_cardbacks = f"{context[source.id].qty_cardbacks :,d}"
        context[source.id].qty_tokens = f"{context[source.id].qty_tokens :,d}"

    return render(request, 'cardpicker/credits.html', {"sources": context,
                                                       "total_count": total_count_f})


def search(request):
    # search endpoint function - the frontend requests card HTML info from this url
    # pull info out of request
    drive_order = request.POST.get('drive_order').split(",")
    query = request.POST.get('query').rstrip("\n")
    slots = request.POST.get('slots')
    dom_id = request.POST.get('dom_id')
    face = request.POST.get('face')
    req_type = request.POST.get('req_type')
    group = request.POST.get('group')
    selected_img = request.POST.get('selected_img')

    # this function can either receive a request with "normal" type with query like "t:goblin",
    # or a request with "token" type with query like "goblin", so handle both of those cases here
    if query.lower()[0:2] == "t:":
        query = query[2:]
        req_type = "token"

    # now that we've potentially trimmed the query for tokens, convert the query to a searchable string
    query = to_searchable(query)

    # search for tokens if this request is for a token
    if req_type == "token":
        results = query_es_token(drive_order, query)

    # search for cardbacks if request is for cardbacks
    elif req_type == "back":
        results = query_es_cardback()

    # otherwise, search normally
    else:
        results = query_es_card(drive_order, query)

    context = {
        "data": results,
        "query": query,
        "slots": slots,
        "dom_id": dom_id,
        "face": face,
        "req_type": req_type,
        "group": group,
        "selected_img": selected_img
    }

    return render(request, 'cardpicker/card.html', {"card": context})


def review(request):
    # return the review page with the order dict and quantity from parsing the given text input as context
    # used for rendering the review page

    # TODO: rename this to input_text?
    if request.method == "POST":
        form = InputText(request.POST)
        if form.is_valid():
            print("Request is valid for text uploader")
            # retrieve drive order and raw user input from request
            drive_order = list(request.POST.get("drive_order").split(","))
            lines_raw = form['card_list'].value()

            # parse the text input to obtain the order dict and quantity in this order
            (order, qty) = parse_text(lines_raw)

            # build context
            context = build_context(drive_order, order, qty)

            return render(request, 'cardpicker/review.html', context)

    return redirect('index')


def insert_text(request):
    # return a JSON response with the order dict and quantity from parsing the given input
    # used for inserting new cards into an existing order on the review page
    text = request.POST.get('text')
    offset = int(request.POST.get('offset'))

    # parse the text input to obtain the order dict and quantity in this addition to the order
    (order, qty) = parse_text(text, offset)

    # remove the "-" element from the common cardback slot list so the selected common cardback doesn't reset on us
    order["back"][""]["slots"].pop(0)

    # build context
    context = {
        "order": order,
        "qty": qty,
    }

    return JsonResponse(context)


def input_csv(request):
    # return the review page with the order dict and quantity from parsing the given CSV input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputCSV(request.POST, request.FILES)
        if form.is_valid():
            print("Request is valid for CSV uploader")

            # retrieve drive order and csv file from request
            drive_order = list(request.POST.get("drive_order").split(","))
            csvfile = request.FILES['file'].read()

            # parse the csv file to obtain the order dict and quantity in this order
            (order, qty) = parse_csv(csvfile)

            # build context
            context = build_context(drive_order, order, qty)

            return render(request, 'cardpicker/review.html', context)

    return redirect('index')


def input_xml(request):
    # return the review page with the order dict and quantity from parsing the given XML input as context
    # used for rendering the review page
    if request.method == "POST":
        form = InputXML(request.POST, request.FILES)
        if form.is_valid():
            try:
                print("Request is valid for XML uploader")

                # retrieve drive order and XML file from request
                drive_order = list(request.POST.get("drive_order").split(","))
                xmlfile = request.FILES['file'].read()

                # parse the XML file to obtain the order dict and quantity in this order
                (order, qty) = parse_xml(xmlfile, 0)

                # build context
                context = build_context(drive_order, order, qty)

                return render(request, 'cardpicker/review.html', context)

            except IndexError:
                # IndexErrors can occur when trying to parse old XMLs that don't include the search query
                return redirect('index')

    return redirect('index')


def insert_xml(request):
    # return a JSON response with the order dict and quantity from parsing the given XML input
    # used for inserting new cards into an existing order on the review page
    xml = request.POST.get('xml')
    offset = int(request.POST.get('offset'))

    # parse the XML input to obtain the order dict and quantity in this addition to the order
    (order, qty) = parse_xml(xml, offset)

    # remove the - element from the common cardback slot list so the selected common cardback doesn't reset on us
    order["back"][""]["slots"].pop(0)

    # build context
    context = {
        "order": order,
        "qty": qty,
    }

    return JsonResponse(context)
