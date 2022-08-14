import { Modal } from 'bootstrap';

import { handle_error } from './base.js';
import { Card } from './card.js';

function add_to_group(group, dom_ids) {
    if (groups[group] === undefined) {
        groups[group] = new Set();
    }
    dom_ids.forEach(groups[group].add, groups[group]);
}

export function bracket(qty) {
    // small helper function to calculate the MPC bracket the current order lands in
    // TODO: write this more efficiently?
    qty = parseInt(qty);
    let brackets = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612];
    for (let i = 0; i < brackets.length; i++) {
        if (brackets[i] >= qty) {
            return brackets[i].toString();
        }
    }
    return brackets[brackets.length - 1].toString();
}

export function update_qty(new_qty) {
    if (new_qty !== undefined) {
        qty = new_qty;
        document.getElementById("order_qty").innerHTML = new_qty;
        document.getElementById("order_bracket").innerHTML = bracket(new_qty);
    }
}

export function switch_faces() {
    front_visible = !front_visible;

    let front_faces = document.getElementsByClassName("card-front");
    let back_faces = document.getElementsByClassName("card-back");
    let switch_button = document.getElementById("switchFacesBtn");

    // decide what styles the front and back cards should take on, as well as the switch face button text
    let front_style = "none";
    let back_style = "";
    let button_text = "Switch to Fronts";
    if (front_visible) {
        front_style = "";
        back_style = "none";
        button_text = "Switch to Backs";
    }

    // apply changes to fronts, backs, and switch face button
    for (let i = 0; i < front_faces.length; i++) {
        front_faces[i].style.display = front_style;
    }
    for (let i = 0; i < back_faces.length; i++) {
        back_faces[i].style.display = back_style;
    }

    switch_button.textContent = button_text;
}

export function insert_data(drive_order, fuzzy_search, order) {
    // clear out the list of cards with specific versions that don't exist anymore
    cards_not_found = [];

    // switch to fronts if necessary
    if (!front_visible) {
        switch_faces();
    }

    const loadModal = Modal.getOrCreateInstance('#loadModal');
    loadModal.show();

    // query Django for info on this order
    // expected to return the order dict (from function parameter) but with card info filled in under the
    // ['data'] property for each card
    $.ajax({
        type: 'POST',
        url: '/ajax/msearch/',
        dataType: 'JSON',
        data: {
            'drive_order': drive_order,
            'fuzzy_search': fuzzy_search,
            'order': JSON.stringify(order),
        },
        success: function (data) {
            // insert cards with this data into the dom
            if (Object.keys(data).length === 0 || (data.exception !== "" && data.exception !== null && data.exception !== undefined)) {
                handle_error(data.exception);
            } else {
                build_cards(data);
            }
        },
        error: function () {
            alert("Error");
            // TODO: not shit?
        },
        complete: function () {
            // pause for a moment so the modal can catch up in case our results return too quickly
            setTimeout(function () {
                loadModal.hide();
                // alert the user if specific card versions they requested no longer exist
                alert_missing_versions(cards_not_found);
                // alert the user if they've reached the cap of 612 cards
                if (qty >= 612) {
                    $('#maxCardsToast').toast('show');
                }
            }, 700);
        }
    })

    // update quantity and bracket variables and html
    update_qty(qty);
}


function alert_missing_versions(cards_not_found) {
    // alert the user if versions of cards they requested couldn't be found
    if (cards_not_found.length > 0) {
        // locate the cards not found modal table in the dom
        let not_found_table = document.getElementById("missingCardsTable");

        // clear out any existing rows from the table ("destroy all children" lmao)
        not_found_table.innerHTML = "";

        // also sort the list of cards not found by slot number
        if (cards_not_found.length > 1) {
            cards_not_found.sort((a, b) => a.slot - b.slot);
        }

        // add each missing card to the table
        for (let i = 0; i < cards_not_found.length; i++) {
            // stick this not found image into the table
            let row_element = document.createElement("tr");

            // formatting for drive ID field
            let id_element = document.createElement("td");
            id_element.style.textAlign = "center";
            // id_element.innerText = cards_not_found[i].id;

            let id_text_element = document.createElement("code");
            id_text_element.innerText = cards_not_found[i].identifier;
            id_element.appendChild(id_text_element);

            // formatting for slot field
            let slot_element = document.createElement("td");
            slot_element.style.textAlign = "center";
            slot_element.innerText = cards_not_found[i].slot;

            // formatting for search query field
            let query_element = document.createElement("td");
            if (!cards_not_found[i].query || cards_not_found[i].query === "None") {
                query_element.innerText = "Not given"
            } else {
                query_element.innerText = cards_not_found[i].query;
            }

            // attach all three to the row element, then append row element to the table
            row_element.appendChild(id_element);
            row_element.appendChild(slot_element);
            row_element.appendChild(query_element);
            not_found_table.appendChild(row_element);
        }

        // show the modal
        setTimeout(function () {
            Modal.getOrCreateInstance('#missingCardsModal').hide()
        }, 700);
    }
}


export function search_api(drive_order, fuzzy_search, query, slot_id, face, dom_id, req_type = "normal", group = 0, common_back_id = "") {
    // used for individual searches when modifying a card in-place
    $.ajax({
        type: 'POST',
        url: '/ajax/search/',
        dataType: 'JSON',
        data: {
            'drive_order': drive_order,
            'fuzzy_search': fuzzy_search,
            'query': query,
            'req_type': req_type,
        },
        success: function (data) {
            if (Object.keys(data).length === 0 || (data.exception !== "" && data.exception !== null && data.exception !== undefined)) {
                handle_error(data.exception);
            } else {
                build_card(data, dom_id, data['query'], slot_id, face, group, common_back_id);
            }
        },
        error: function () {
            // callback here in 5 seconds
            setTimeout(function () {
                search_api(drive_order, fuzzy_search, query, slot_id, dom_id, face, req_type, group, common_back_id);
            }, 5000)
        }
    })
}

function get_common_cardback_id(data) {
    // if common cardback not present in data, retrieve the currently selected ID from the dom
    if (data["common_cardback"]["in_order"] === "true") {
        return data["common_cardback"]["id"];
    } else {
        // attempt to retrieve ID from dom
        let cardback_obj = $("#slot--back").data("obj");
        if (cardback_obj !== undefined) {
            return cardback_obj.get_curr_img().id;
        } else {
            return "";
        }
    }
}

function build_cards(data) {
    // call build_card on multiple cards by interpreting an order dict, and handle grouping
    let cardback_id = get_common_cardback_id(data);
    for (const face of ["front", "back"]) {
        for (let key in data[face]) {

            let req_type = data[face][key]["req_type"];
            let slot_ids = data[face][key]["slots"]

            let group = 0;
            if (slot_ids.length > 1 & req_type !== "back") {
                group = max_group;
                max_group++;
            }

            // build the cards and keep track of constructed dom IDs
            let dom_ids = [];
            for (let i = 0; i < slot_ids.length; i++) {
                let dom_id = "slot" + slot_ids[i][0].toString() + "-" + face;
                build_card(data[face][key], dom_id, key, slot_ids[i], face, group, cardback_id);
                dom_ids.push(dom_id);
            }

            if (slot_ids.length > 0 && req_type !== "back" && group > 0) {
                add_to_group(group, dom_ids)
            }
        }
    }
}


function build_card(card, dom_id, query, slot_id, face, group, common_back_id = "") {
    // accepts search result data and information about one specific card slot, and builds it
    // first creates the dom element if it doesn't exist, then instantiates the Card which will attach itself
    // to that element
    if ($('#' + dom_id).length < 1) {
        // create div element for this card to occupy with the appropriate classes
        // let card_elem = document.createElement("div");
        let card_elem = document.getElementById("basecard").cloneNode(true);
        card_elem.id = dom_id;
        card_elem.className = "card mpc-order mpccard card-" + face;

        // set up IDs for this man
        let class_ids = [
            "mpccard-slot",
            "padlock",
            "remove",
            "card-img",
            "card-img-prev",
            "card-img-next",
            "mpccard-name",
            "mpccard-source",
            "mpccard-counter",
            "mpccard-counter-btn",
            "prev",
            "next",
        ];
        for (let i = 0; i < class_ids.length; i++) {
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
        } else {
            document.getElementById("card-container").appendChild(card_elem);
        }
    }

    // for cardbacks, decide the group number on a slot-by-slot basis, due to how multiple cardbacks works
    if ((card.req_type === "back" && (slot_id[1] === common_back_id || slot_id[1] === "")) || slot_id[0] === "-") {
        group = 1;
        add_to_group(group, [dom_id]);
        slot_id[1] = common_back_id;
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
    return group;
}


export function insert_text() {
    let text = document.getElementById("id_card_list").value;

    $.post(
        '/ajax/text/',
        {
            'text': text,
            'offset': qty
        },
        function (data) {
            if (Object.keys(data).length === 0 || (data.exception !== "" && data.exception !== null && data.exception !== undefined)) {
                handle_error(data.exception);
            } else {
                qty += data.qty;
                insert_data(drive_order, fuzzy_search, data.order);
            }
        },
        'json'
    );

    Modal.getOrCreateInstance('#textModal').hide();
    return false;
}


export function insert_xml() {
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
                if (Object.keys(data).length === 0 || (data.exception !== "" && data.exception !== null && data.exception !== undefined)) {
                    handle_error(data.exception);
                } else {
                    qty += data.qty;
                    insert_data(drive_order, fuzzy_search, data.order);
                }
            },
            'json'
        ));
    }
}


export function insert_link() {
    let list_url = document.getElementById("id_list_url").value;

    $.post(
        '/ajax/link/',
        {
            'list_url': list_url,
            'offset': qty
        },
        function (data) {
            if (Object.keys(data).length === 0 || (data.exception !== "" && data.exception !== null && data.exception !== undefined)) {
                handle_error(data.exception);
            } else {
                qty += data.qty;
                insert_data(drive_order, fuzzy_search, data.order);
            }
        },
        'json'
    );

    Modal.getOrCreateInstance('#inputLinkModal').hide();
    return false;
}

function build_blog_card(container_id, card) {
    // iterate over the search results
    let dom_id = card.identifier;

    // copy the base card sitting in the dom, adjust it, then stick it into this artist's card container
    let card_elem = document.getElementById("basecard-new").cloneNode(true);
    card_elem.style.display = "";
    card_elem.id = dom_id;

    // set up element IDs for this man
    let class_ids = [
        "mpccard-slot",
        "card-img",
        "mpccard-name",
        "mpccard-source",
    ];
    for (let i = 0; i < class_ids.length; i++) {
        card_elem.getElementsByClassName(class_ids[i])[0].id = dom_id + "-" + class_ids[i];
    }

    // stick into dom under the source's card container, and instantiate the Card
    document.getElementById(container_id).appendChild(card_elem);
    let new_card = new CardRecent(card, dom_id);
}
