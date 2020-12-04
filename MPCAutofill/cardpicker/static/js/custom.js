// keep track of the slide indexes of each individual card
var indexMap = new Map();

function plusDivs(element, n) {
    // get all images in the current slideshow
    let curr_id = element.parentElement.id;

    const slideshow = document.getElementById(curr_id);
    const x = slideshow.getElementsByClassName("card-img");

    // if the current id isn't in the map yet, initialise it to 1
    // otherwise, retrieve its value
    let idx = 1;
    if (indexMap.has(curr_id)) {
        idx = indexMap.get(curr_id);
    } else {
        indexMap.set(curr_id, 1);
    }

    // add +/-1 for paging forward/back
    idx += n;

    // circular slideshow
    if (idx > x.length) idx = 1;
    if (idx < 1) idx = x.length;

    // if this card is locked with its group, keep the others in its group in sync
    let headerman = slideshow.getElementsByClassName("padlock");
    if (headerman.length > 0 && headerman[0].innerHTML === '\u{1F512}') {
        let this_group = document.getElementsByClassName(headerman[0].className);
        for (let i = 0; i < this_group.length; i++) {
            let parent_elem = this_group[i].parentElement.parentElement
            let this_elem = parent_elem.getElementsByClassName("card-img");
            indexMap.set(parent_elem.id, idx);
            updateCard(curr_id, this_elem, idx, parent_elem);
        }
    } else {
        updateCard(curr_id, x, idx, slideshow);
    }
}

function updateCard(curr_id, x, idx, slideshow) {
    // set the desired image in slideshow to visible,
    // then set all other images to invisible
    x[idx - 1].style.display = "inline-block";
    // TODO: The below two lines allow for a smooth slideshow but commented out for now bc I'm fucking with things
    // var a = new Image();
    // a.src = x[idx-1].url;
    for (let i = 0; i < x.length; i++) {
        if (i !== (idx-1)) {
            x[i].style.display = "none";
        }
    }
    indexMap.set(curr_id, idx);

    // update card name, source and counter
    let curr_card_obj;
    if (curr_id === "cardbackselector") {
        // the button that triggered this fcn call is for the common cardback picker
        curr_card_obj = cardbacks_common[idx - 1];
        // update the sources for all of the defaulted cardbacks to reflect this one
        let common_elems = document.getElementsByClassName("card-img-back-defaulted");
        for (let i = 0; i < common_elems.length; i++) {
            common_elems[i].src = x[idx - 1].src;
        }
    } else {
        // the button press that triggered this is for a normal card face
        let idnum = parseInt(curr_id.split("-")[0].substring(4));
        // assume the button press was for a card front
        curr_card_obj = cardfronts[idnum][idx - 1];
        if (curr_id.split("-")[1] === "back") {
            // the button press was for a card back
            curr_card_obj = cardbacks[idnum][idx - 1];
        }
    }

    let nameElem = slideshow.getElementsByClassName("mpccard-name")[0];
    nameElem.innerHTML = curr_card_obj['name'];

    let sourceElem = slideshow.getElementsByClassName("mpccard-source")[0];
    sourceElem.innerHTML = curr_card_obj['source'] + " [" + curr_card_obj['dpi'] + " DPI]";

    let counterElem = slideshow.getElementsByClassName("mpccard-counter")[0];
    counterElem.innerHTML = idx.toString() + "/" + x.length.toString();
}

function download(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function generateXml() {
    // create xml document
    let doc = document.implementation.createDocument("", "", null);
    let e = document.getElementById("cardstockSelect");
    let selectedCardstock = e.options[e.selectedIndex].value;

    // top level XML doc element, attach everything to this
    let orderElem = doc.createElement("order");

    // order details - quantity, bracket, stock
    let detailsElem = doc.createElement("details");
    let qtyElem = doc.createElement("quantity");
    let bracketElem = doc.createElement("bracket");
    let stockElem = doc.createElement("stock");
    let downloadOnly = document.getElementById("downloadOnly");
    let downloadOnlyElem = doc.createElement("downloadOnly");

    qtyElem.appendChild(doc.createTextNode(qty));
    bracketElem.appendChild(doc.createTextNode(bracket));
    stockElem.appendChild(doc.createTextNode(selectedCardstock));
    downloadOnlyElem.appendChild(doc.createTextNode(downloadOnly.checked));
    detailsElem.appendChild(qtyElem);
    detailsElem.appendChild(bracketElem);
    detailsElem.appendChild(stockElem);
    detailsElem.appendChild(downloadOnlyElem);
    orderElem.appendChild(detailsElem);

    // add the card images for fronts and backs
    var faces = ["front", "back"];
    for (let j = 0; j < faces.length; j++) {
        let cardImages = {};
        // get all elements for this card face and loop over them
        let visibleImages = document.getElementsByClassName("card-img card-img-" + faces[j]);
        for (let i = 0; i < visibleImages.length; i++) {
            if (visibleImages[i].style.display !== "none") {
                // retrieve the visible face's google drive ID
                let src = visibleImages[i].src;
                src = src.slice(src.lastIndexOf("=") + 1);
                // retrieve the card's slot number from the element ID
                // var parentId = visibleImages[i].parentElement.id;
                let parentId = visibleImages[i].parentElement.parentElement.id;
                let currentSlot = parseInt(parentId.slice(4, parentId.indexOf("-")));
                // add to cardImages
                if (!(src in cardImages)) {
                    cardImages[src] = [];
                }
                cardImages[src].push(currentSlot);
            }
        }


        // only add this face to the XML doc if there are cards with the face
        if (Object.keys(cardImages).length > 0) {
            // add to order
            let faceElem = doc.createElement(faces[j] + "s");
            for (let key in cardImages) {
                let currentIndices = "[" + String(cardImages[key]) + "]";
                let cardElem = doc.createElement("card");
                let idElem = doc.createElement("id");
                let slotsElem = doc.createElement("slots");
                idElem.appendChild(doc.createTextNode(key));
                slotsElem.appendChild(doc.createTextNode(currentIndices));
                cardElem.appendChild(idElem);
                cardElem.appendChild(slotsElem);
                faceElem.appendChild(cardElem);
            }

            // add to order
            orderElem.appendChild(faceElem);
        }
    }

    // default cardback
    var defaultBackElem = doc.createElement("cardback");
    var defaultBacks = document.getElementsByClassName("card-img-back-common");
    for (let i = 0; i < defaultBacks.length; i++) {
        if (defaultBacks[i].style.display !== "none") {
            let src = defaultBacks[i].src;
            // trim off the excess filepath garbage to just retrieve the drive ID
            src = src.slice(src.lastIndexOf("=") + 1);
            defaultBackElem.appendChild(doc.createTextNode(src));
            orderElem.appendChild(defaultBackElem);
            break;
        }
    }

    // attach everything to the doc
    doc.appendChild(orderElem);

    // serialise to XML
    let serialiser = new XMLSerializer();
    let xml = serialiser.serializeToString(doc);

    // download to the user
    download("cards.xml", xml);
}

function switchFaces() {
    let front_faces = document.getElementsByClassName("card-front");
    let back_faces = document.getElementsByClassName("card-back");
    let switch_button = document.getElementById("switchFacesBtn");

    let front_style = "none";
    let back_style = "inline-block";
    let button_text = "Switch to Fronts";
    if (front_faces[0].style.display === "none") {
        front_style = "inline-block";
        back_style = "none";
        button_text = "Switch to Backs";
    }

    for (let i = 0; i < front_faces.length; i++) {
        front_faces[i].style.display = front_style;
    }
    for (let i = 0; i < back_faces.length; i++) {
        back_faces[i].style.display = back_style;
    }

    switch_button.textContent = button_text;
}

function toggleLock(group_number) {
    let unicode_locked = '\u{1F512}';
    let unicode_unlocked = '\u{1F513}';

    let this_group = document.getElementsByClassName("group" + group_number.toString());
    let locked = this_group[0].innerText === unicode_locked;

    for (let i = 0; i < this_group.length; i++) {
        if (locked) {
            this_group[i].innerHTML = unicode_unlocked;
            this_group[i].style.outline = "none";
        } else {
            this_group[i].innerHTML = unicode_locked;
            this_group[i].style.outline = "2px inset black";
        }
    }
}