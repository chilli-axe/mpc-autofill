function download(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function generate_xml() {
    // create xml document
    let doc = document.implementation.createDocument("", "", null);
    let e = document.getElementById("cardstock-dropdown");
    let selectedCardstock = e.options[e.selectedIndex].value;

    // top level XML doc element, attach everything to this
    let orderElem = doc.createElement("order");

    // order details - quantity, bracket, stock
    let detailsElem = doc.createElement("details");
    let qtyElem = doc.createElement("quantity");
    let bracketElem = doc.createElement("bracket");
    let stockElem = doc.createElement("stock");
    let foil = document.getElementById("cardstock-foil");
    let foilElem = doc.createElement("foil");

    qtyElem.appendChild(doc.createTextNode(qty));
    bracketElem.appendChild(doc.createTextNode(bracket(qty)));
    stockElem.appendChild(doc.createTextNode(selectedCardstock));
    foilElem.appendChild(doc.createTextNode(foil.checked));
    detailsElem.appendChild(qtyElem);
    detailsElem.appendChild(bracketElem);
    detailsElem.appendChild(stockElem);
    detailsElem.appendChild(foilElem);
    orderElem.appendChild(detailsElem);

    // take note of the selected common cardback's ID - will come in handy in a minute
    let cardback_id = $("#slot--back").data("obj").get_curr_img().id;

    // set up an object we can use to keep track of what to write to the XML
    let order_map = {};
    order_map['front'] = {};
    order_map['back'] = {};
    let num_imgs = {'front': 0, 'back': 0};

    // iterate over all cards in the order - fronts and backs, including common cardback on right panel
    let card_elems = document.getElementsByClassName("mpc-order");
    for (let i = 0; i < card_elems.length; i++) {
        // retrieve information about the current card object
        let curr_obj = $('#' + card_elems[i].id).data("obj");
        
        // only proceed if the card obj has any search results
        if (curr_obj.cards.length > 0) {
            let curr_id = curr_obj.get_curr_img().id;
        
            if (curr_id !== cardback_id) {
                // the card we're looking at isn't the common cardback, so we care about it
                let curr_face = curr_obj.face;
                if (order_map[curr_face][curr_id] === undefined) {
                    // this image doesn't exist in the order map yet, so add it
                    let curr_img = curr_obj.get_curr_img();
                    let curr_name = curr_img.name + "." + curr_img.thumbpath;
                    order_map[curr_face][curr_id] = {
                        "id": curr_id, // image ID
                        "slots": [curr_obj.slot], // slot number
                        "name": curr_name,
                        "query": curr_obj.get_query() // search query
                    };
                    // we found an image in this face
                    num_imgs[curr_face] = 1;

                } else {
                    // add this image's slot number to the existing info about this card
                    order_map[curr_face][curr_id]["slots"].push(curr_obj.slot);
                }
            }
        }
    }   

    // insert everything from the order map into XML elements
    for (let face in order_map) {
        if (num_imgs[face] > 0) {
            // this face has a nonzero number of things in it, so we should add to XML
            // (relevant for the back face, where we skip adding it to the XML if there are no special card backs)

            // create a parent element for this face
            let faceElem = doc.createElement(face + "s");

            for (let img in order_map[face]) {
                // add this Card to XML by first creating an element for it, then looping over its properties
                // and adding them too
                let cardElem = doc.createElement("card");
                for (let property in order_map[face][img]) {
                    // add this property
                    let thisElem = doc.createElement(property);
                    thisElem.appendChild(
                        doc.createTextNode(order_map[face][img][property])
                    );
                    cardElem.appendChild(thisElem);
                }
                // add this element to the face element
                faceElem.appendChild(cardElem);
            }
            // add this face element to the order
            orderElem.appendChild(faceElem);
        }
    }

    // finally, add the default cardback
    let backElem = doc.createElement("cardback");
    backElem.appendChild(
        doc.createTextNode(cardback_id)
    );
    orderElem.appendChild(backElem);

    // attach everything to the doc
    doc.appendChild(orderElem);

    // serialise to XML
    let serialiser = new XMLSerializer();
    let xml = serialiser.serializeToString(doc);

    // download to the user
    download("cards.xml", xml);
}

function switch_faces() {
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

function download_all() {
    // TODO: can we rewrite this to zip up the requested images?
    // TODO: or download individually without opening one billion windows?
    // get all Card objects using a set to avoid duplicates
    let card_set = new Set();
    $(".mpc-order").each(function () {
        let curr_obj = $(this).data("obj");
        // check if the Card is empty before trying to retrieve its current img ID
        if (!curr_obj.empty) {
            card_set = card_set.add(curr_obj.get_curr_img().id);
        }
    })

    // convert to array, then iterate over array and trigger download on each drive id
    let card_array = Array.from(card_set);
    for (let i = 0; i < card_array.length; i++) {
        trigger_download(card_array[i]);
    }
}

function bracket(qty) {
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

function update_qty(new_qty) {
    qty = new_qty;
    document.getElementById("order_qty").innerHTML = new_qty;
    document.getElementById("order_bracket").innerHTML = bracket(new_qty);
}

function clearText() {
    let textarea_elem = document.getElementById("id_card_list");
    textarea_elem.value = "";
    // textarea_elem.blur();
}

function remove_card() {
    let slot_to_remove = document.getElementById("removeCardId").slot_num;
    if (qty > 1) {

        // remove the Card from its lock group/s (if it's part of any) and delete its elements
        let faces = ["-front", "-back"];
        for (let i=0; i<faces.length; i++) {
            let this_elem = $("#slot" + slot_to_remove.toString() + faces[i]);
            let this_obj = this_elem.data("obj");

            // if the Card object is in a group, remove it from that group
            if (this_obj.group > 0) {
                // the Card's dom ID will be sitting in the array groups[this_obj.group],
                // at index groups[this_obj.group].indexOf(this_obj.dom_id)
                groups[this_obj.group].delete(this_obj.dom_id);
            }

            // delete the dom element
            this_elem.remove();
        }

        update_qty(qty-1);

        if (slot_to_remove !== qty) {
            // update the card slots on all cards after the one we just deleted
            for (let i=slot_to_remove; i<qty; i++) {
                $("#slot" + (i+1).toString() + "-front").data("obj").update_slot(i);
                $("#slot" + (i+1).toString() + "-back").data("obj").update_slot(i);
            }
        }
    }
    $('#removeCardModal').modal('hide');
}

function set_cardstock(data) {
    document.getElementById("cardstock-dropdown").value = data.cardstock;
    if (data.foil === "true") {
        $(document.getElementById("cardstock-foil")).bootstrapToggle("on");
    }
}