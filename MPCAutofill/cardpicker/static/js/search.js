// set up ajax to attach the CSRF token to all requests to the server
// lifted from https://docs.djangoproject.com/en/3.1/ref/csrf/#ajax
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


const csrftoken = getCookie('csrftoken');


function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});


function insert_data(drive_order, order) {
    // switch to fronts if necessary
    if (!front_visible) {
        switchFaces();
    }
    $('#loadModal').modal('show')
    
    // query Django for info on this order
    // expected to return the order dict (from function parameter) but with card info filled in under the
    // ['data'] property for each card
    $.ajax({
        type: 'POST',
        url: '/ajax/msearch/',
        dataType: 'JSON',
        data: {
            'drive_order': drive_order,
            'order': JSON.stringify(order),
        },
        success: function(data) {
            // insert cards with this data into the dom
            build_cards(data);
        },
        error: function () {
            alert("Error");
            // TODO: not shit?
        },
        complete: function() {
            // pause for a moment so the modal can catch up in case our results return too quickly
            setTimeout(function(){ $('#loadModal').modal('hide'); }, 700);
            
        }
   })
   
   // update quantity and bracket variables and html
   update_qty(qty);
}


function search_api(drive_order, query, slot_id, face, dom_id, req_type = "normal", group = 0) {
    // used for individual searches when modifying a card in-place
    $.ajax({
        type: 'POST',
        url: '/ajax/search/',
        dataType: 'JSON',
        data: {
            'drive_order': drive_order,
            'query': query,
            'req_type': req_type,
        },
        success: function(data) {
            build_card(data, dom_id, data['query'], slot_id, face, group);
        },
        error: function () {
            // callback here in 5 seconds
            setTimeout(function () {
                search_api(drive_order, query, slot_ids, dom_id, face, req_type, group);
            }, 5000)
        }
   })
}


function build_cards(data) {
    // call build_card on multiple cards by interpreting an order dict, and handle grouping 
    for (let face in data) {
        for (let key in data[face]) {

            let req_type = data[face][key]["req_type"];
            let slot_ids = data[face][key]["slots"]

            let group = 0;
            if (req_type === "back") {
                group = 1;
            } else if (slot_ids.length > 1) {
                group = max_group;
                max_group++;
            }

            // build the cards and keep track of constructed dom IDs
            let dom_ids = [];
            for (let i=0; i<slot_ids.length; i++) {
                let dom_id = "slot" + slot_ids[i][0].toString() + "-" + face;
                build_card(data[face][key].data, dom_id, key, slot_ids[i], face, group);
                dom_ids.push(dom_id);
            }

            if (slot_ids.length > 0) {
                if (group === 1 && groups[group] !== undefined) {
                    // this code should run when the common back group already exists but we have new cards to add to it
                    // remove the first element (the right panel common cardback) from dom_ids, then smush the existing
                    // ids and the new ids together
                    // dom_ids = dom_ids.slice(1);
                    groups[group] = groups[group].concat(dom_ids);
                } else {
                    groups[group] = dom_ids;
                }
            }
        }
    }
}


function build_card(card, dom_id, query, slot_id, face, group) {
    // accepts search result data and information about one specific card slot, and builds it
    // first creates the dom element if it doesn't exist, then instantiates the Card which will attach itself
    // to that element
    if ($('#' + dom_id).length < 1) {
        // create div element for this card to occupy with the appropriate classes
        // let card_elem = document.createElement("div");
        let card_elem = document.getElementById("basecard").cloneNode(true);
        card_elem.id = dom_id;
        card_elem.className = "card mpccard card-" + face;

        // set up IDs for this man
        let class_ids = [
            "mpccard-slot",
            "dl-button",
            "padlock",
            "dl-loading",
            "card-img",
            "card-img-prev",
            "card-img-next",
            "mpccard-name",
            "mpccard-source",
            "mpccard-counter",
            "prev",
            "next",
        ];
        for (let i=0; i<class_ids.length; i++) {
            card_elem.getElementsByClassName(class_ids[i])[0].id = dom_id + "-" + class_ids[i];
        }

        // because jquery is asynchronous, there's no guarantee that these will be created in the correct order
        // so, ensure they're ordered by slot number
        card_elem.style = "";
        card_elem.style.order = slot_id[0];

        // if this is a cardback elem, set it to display: none
        if (face === "back") {
            card_elem.style.display = "none";
        }

        // start at opacity 0 so cards can fade in
        card_elem.style.opacity = "0";

        // stick new card element into dom
        if (slot_id[0] === "-") {
            // handle common cardback slightly differently
            // we need to adjust its classes, make sure it's visible, and insert it in a different spot
            card_elem.className = "card mpccard card-back-common";
            card_elem.style.display = "";
            document.getElementById("cardback-container").appendChild(card_elem);
        }
        else {
            document.getElementById("card-container").appendChild(card_elem);
        }
    }

    // insert the returned data into this card's dom element
    // since the Card will attach itself to the relevant dom element as soon as it's instantiated, 
    // we don't need to keep track of it as a variable here
    let new_card = new Card(
        card.data,
        query,
        dom_id,
        slot_id[0],
        face,
        card.req_type,
        group,
        slot_id[1]
    );
    return dom_id;
}

function insert_text() {
    let text = document.getElementById("id_card_list").value;

    $.post(
        '/ajax/text/',
        {
            'text': text,
            'offset': qty
        },
        function (data) {
            qty += data.qty;
            insert_data(drive_order, data.order);
        },
        'json'
    );

    $('#textModal').modal('hide');
    return false;
}


function insert_xml() {
    // read the XML file as text, then do a POST request with the contents
    let xmlfiles = document.getElementById("xmlfile").files;
    if (xmlfiles.length > 0) {
        xmlfiles[0].text().then(text => $.post(
            '/ajax/xml/',
            {
                'xml': text,
                'offset': qty
            },
            function (data) {
                qty += data.qty;
                insert_data(drive_order, data.order);
            },
            'json'
        ));
    }
}

function driveURL(driveID) {
    // small helper function to insert a drive ID into a thumbnail URL and return it
    return "https://drive.google.com/thumbnail?sz=w400-h400&id=" + driveID
    // return "https://lh3.googleusercontent.com/d/" + driveID + "=w400-h400";
}

function build_new_cards(source, data, more) {
    // parse the given json and iterate over the search results
    let data_parsed = JSON.parse(data);

    for (let i=0; i<data_parsed.length; i++) {
        let card_item = data_parsed[i];

        // copy the base card sitting in the dom, adjust it, then stick it into this artist's card container
        let card_elem = document.getElementById("basecard").cloneNode(true);
        card_elem.style.display = "inline";

        card_elem.id = card_item['pk'];

        // set up card's image source, name, and dpi
        card_elem.getElementsByClassName("card-img")[0].src = driveURL(card_item['pk']);
        card_elem.getElementsByClassName("mpccard-name")[0].innerHTML = card_item['fields']['name'];
        card_elem.getElementsByClassName("mpccard-source")[0].innerHTML = 
            source + " [" + card_item['fields']['dpi'] + " DPI]";

        // do some date handling: format like "20 February 2021"
        let d = new Date(Date.parse(card_item['fields']['date']));
        const options = {year: 'numeric', month: 'long', day: 'numeric' };
        card_elem.getElementsByClassName("mpccard-slot")[0].innerHTML = d.toLocaleDateString('en-AU', options)

        // stick into dom under the source's card container
        document.getElementById(source + "-container").appendChild(card_elem);
        
        // fade in when the thumbnail loads
        var img = new Image();
        img.onload = function() { $(card_elem).animate({opacity: 1}, 250); }
        img.src = driveURL(card_item['pk']);

        // hide/show the 'load more' button
        if (more == "true") {
            document.getElementById(source + "-more").style.display = "";
        } else {
            document.getElementById(source + "-more").style.display = "none";
        }
    }

    // increment page counter whenever a page is inserted
    pages[source] = pages[source] + 1;
}

function load_new_cards(source) {
    // ajax function to ask the server for a page on the What's New page (kek) and stick it into the dom
    $.ajax({
        type: 'POST',
        url: '/ajax/getnew/',
        data: {
            'source': source,
            'page': pages[source],
        },
        success: function(data) {
            // use the search results to stick the new page into the dom
            build_new_cards(source, data.sources[source].hits, data.sources[source].more);            
        },
        error: function () {
            // callback here in 5 seconds
            // alert("fucked up");
        }
    })
}