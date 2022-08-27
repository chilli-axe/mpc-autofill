import { search_api } from './search.js';
require('bootstrap-icons/font/bootstrap-icons.css');
import { remove_card } from './review.js';
import Modal from 'bootstrap/js/dist/modal';

function wrap0(idx, max) {
    // small helper function to wrap an index between 0 and max-1
    if (idx >= max) idx = 0;
    if (idx < 0) idx = max - 1;
    return idx;
}

function format_source(source, dpi) {
    return source + " [" + dpi.toString() + " DPI]";
}

export function selectElementContents(el) {
    // TODO: this is a bit fucked atm
    // select all text in contentEditable
    // http://stackoverflow.com/a/6150060/145346
    let range = document.createRange();
    range.selectNodeContents(el);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function trigger_download(img_url, new_tab = true) {
    // download an image with the given download link
    let element = document.createElement('a');
    element.href = img_url;
    element.setAttribute('download', "deez.png");
    if (new_tab) element.target = "_blank";

    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function image_size_to_mb_string(size) {
    let size_mb = size / 1000000;
    size_mb = Math.round(size_mb * 100) / 100;  // 2 decimal places
    return size_mb.toString() + " MB"
}

class CardBase {
    constructor(cards, query, dom_id, slot, face, req_type, group, selected_img = null) {
        this.setup_card(cards, query, dom_id, slot, face, req_type, group, selected_img);
    }

    get_curr_img() {
        // return the currently selected card object
        return this.cards[this.img_idx];
    }

    enable_modal(modal_id) {
        // disable hover-based shadows on the parent element temporarily while we bring up
        // the modal, then re-enable it
        this.pe.classList.remove("mpccard-hover");
        Modal.getOrCreateInstance('#' + modal_id).show();
        setTimeout(function () {this.pe.classList.add("mpccard-hover")}.bind(this), 100);
    }

    open_detailed_view() {
        // when the card's thumbnail is clicked, fill its information into the detailed view modal

        // insert the card's name, creator, dpi, and 300 dpi image into the modal
        let view_name = document.getElementById("detailedView-name");
        let view_img = document.getElementById("detailedView-img");
        let view_source = document.getElementById("detailedView-source");
        let view_source_type = document.getElementById("detailedView-sourceType");
        let view_dpi = document.getElementById("detailedView-dpi");
        let view_date = document.getElementById("detailedView-date");
        let view_id = document.getElementById("detailedView-id");
        let view_class = document.getElementById("detailedView-class");
        let view_spinner = document.getElementById("detailedView-spinner");
        let dl_button = document.getElementById("detailedView-dl");
        let view_size = document.getElementById("detailedView-size");

        let curr_img = this.get_curr_img();

        view_name.innerText = curr_img.name;
        view_img.src = curr_img.medium_thumbnail_url;
        view_source.innerText = curr_img.source_name;
        view_source_type.innerText = curr_img.source_type;
        view_dpi.innerText = curr_img.dpi + " DPI";
        view_id.innerText = curr_img.identifier;
        view_date.innerText = curr_img.date;
        view_size.innerText = image_size_to_mb_string(curr_img.size);

        // pretty version of card type/class
        let img_class = "";
        if (this.req_type === "" || this.req_type === "normal") img_class = "Card";
        else if (this.req_type === "token") img_class = "Token";
        else if (this.req_type === "back") img_class = "Cardback";
        view_class.innerText = img_class;

        // use jquery proxy to link the download button to this Card object's dl function
        if (curr_img.download_link === undefined || curr_img.download_link === null) {
            dl_button.style.display = "none";
        } else {
            dl_button.style.display = "";
            $(dl_button).off("click");
            $(dl_button).on('click', function () { // TODO: do we need to `bind` here?
                trigger_download(curr_img.download_link, true);
            }.bind(this));
        }

        // hide the 300 dpi image until it loads in - show a loading spinner in its place until then
        view_img.style.opacity = 0;
        view_spinner.style.opacity = 1;
        var img = new Image();
        img.onload = function () {
            $(view_spinner).animate({opacity: 0}, 250);
            $(view_img).animate({opacity: 1}, 250);
        }
        img.src = curr_img.medium_thumbnail_url;

        // disable hovering on the parent element temporarily while we bring up the modal
        this.enable_modal("detailedViewModal");
    }

    fade_in() {
        if (this.pe.style.opacity === "0") {
            // animating the opacity instead of using fadeIn so things stay in place
            $(this.pe).css("pointer-events", "auto");
            $(this.pe).animate({opacity: 1}, 250, function () {
                // re-enable the hover effect after the card loads in
                this.classList.add("mpccard-hover");
            })
        }
    }
}

// Card class - one for each face of each card slot
// contains logic to page between results, search again with new query, display correct stuff depending on results, etc.
export class Card extends CardBase {
    constructor(cards, query, dom_id, slot, face, req_type, group, selected_img = null) {
        super(cards, query, dom_id, slot, face, req_type, group, selected_img);
    }

    reset() {

        // sets the Card back to its default state
        this.card_counter.style.visibility = "hidden";
        this.card_counter_btn.style.visibility = "hidden";
        this.elem_prev.style.visibility = "hidden";
        this.elem_next.style.visibility = "hidden";
        this.locked = false;
        this.elem_padlock.style.display = "none";
        this.elem_remove.style.display = "none";

        // this.elem_name = document.getElementById(this.dom_id + "-mpccard-name");
        this.elem_name.innerHTML = "";
        this.elem_source.innerHTML = "";
        this.elem_slot.innerHTML = "";

        this.elem_img.src = "";
        this.elem_img_prev.src = "";
        this.elem_img_next.src = "";

        $(this.elem_img).off("click");
        $(this.elem_remove).off("click");
        $(this.elem_padlock).off("click");
        $(this.elem_next).off("click");
        $(this.elem_prev).off("click");
        $(this.elem_name).off("keydown");

        this.elem_name.setAttribute("contentEditable", "false");
    }

    get_query() {
        // for retrieving the query to add to generated XML orders
        // if this card is a token, add "t:" to the query
        if (this.req_type === "token") return "t:" + this.query;
        else return this.query;
    }

    update_idx(n) {
        // determine the new idx of this card, then set it
        let new_idx = wrap0(this.img_idx + n, this.img_count);
        this.set_idx(new_idx);
    }

    set_idx(new_idx) {
        // when setting the card's idx, check if it's in a group and is locked - if so,
        // update all cards in the group too
        if (this.locked) {
            groups[this.group].forEach(function (value) {
                let this_obj = $('#' + value).data("obj");
                this_obj.img_idx = new_idx;
                this_obj.update_card();
            })
        } else {
            this.img_idx = new_idx;
            this.update_card();
        }
    }

    toggle_lock() {
        // toggle locking for this card's group
        let new_state = !this.locked;

        groups[this.group].forEach(function (value) {
            $("#" + value).data("obj").set_lock(new_state);
        })
    }

    set_lock(new_state) {
        // toggle this card between locked and unlocked
        this.locked = new_state;
        let unicode_locked = '<i class="bi bi-lock"></i>';
        let unicode_unlocked = '<i class="bi bi-unlock"></i>';
        if (this.locked) {
            this.elem_padlock.innerHTML = unicode_locked;
            this.elem_padlock.style.textShadow = "0px 0px 5px black, 0px 0px 5px black, 0px 0px 5px black";
        } else {
            this.elem_padlock.innerHTML = unicode_unlocked;
            this.elem_padlock.style.textShadow = "none";
        }
    }

    select_id(identifier) {
        // select the result for this card with the given drive ID
        // idk, that's shit english but you get what I mean man
        for (let i = 0; i < this.cards.length; i++) {
            if (this.cards[i].identifier === identifier) {
                // switch to this index
                this.set_idx(i);
                return;
            }
        }

        // if we didn't return from the function by this point, the version wasn't found
        cards_not_found.push({
            identifier: identifier,
            query: this.query,
            slot: this.slot + 1
        })
    }

    remove_card() {
        // if the order contains more than one image, insert this card's info into the remove card modal,
        // then bring up the modal
        if (qty > 1) {
            document.getElementById("removeCardId").slot_num = this.slot;
            document.getElementById("removeCardId").innerText = this.slot + 1;

            // describe the card differently if no results were found
            let curr_img = this.get_curr_img();
            let curr_name = "No card found, with the search query: \"" + this.query + "\"";
            if (curr_img !== undefined) {
                curr_name = "\"" + curr_img.name + "\"";
            }
            document.getElementById("removeCardName").innerText = curr_name;
            if (prompt_deletion === true) {
                Modal.getOrCreateInstance('#removeCardModal').show();
            } else {
                remove_card();
            }
        }
    }

    update_slot(new_slot) {
        // update this Card's slot number
        this.slot = new_slot;
        this.elem_slot.innerHTML = "Slot " + (new_slot + 1).toString();

        // update this Card's dom_id field and all of its HTML elements with their new IDs with regex
        let re = /slot\d+-/;
        let x = [
            this.pe,
            this.elem_slot,
            this.elem_img,
            this.elem_img_prev,
            this.elem_img_next,
            this.elem_prev,
            this.elem_next,
            this.elem_name,
            this.elem_source,
            this.card_counter,
            this.card_counter_btn,
            this.elem_remove,
            this.elem_padlock
        ];
        for (let i = 0; i < x.length; i++) {
            x[i].id = x[i].id.replace(re, "slot" + new_slot.toString() + "-");
        }

        let new_dom_id = this.dom_id.replace(re, "slot" + new_slot.toString() + "-");

        // if the Card is part of a lock group, update the group with this Card's new dom ID
        if (this.group > 0) {
            groups[this.group].delete(this.dom_id);
            groups[this.group].add(new_dom_id);
        }

        this.dom_id = new_dom_id;
        this.pe.style.order = new_slot;
    }

    open_grid_view() {
        // enable the grid view modal
        this.enable_modal("gridSelectModal");

        // define page size - how many thumbnails to load at a time
        let page_size = 20;
        let grid_img_idx = 0;

        function chk_scroll(e) {
            // insert a new page into the grid modal if the user has scrolled to the bottom
            let elem = $(e.currentTarget), offsetHeight = 100;
            if (elem[0].scrollHeight - elem.scrollTop() - elem.outerHeight() <= offsetHeight) {
                append_page(grid_img_idx, page_size, this);
                grid_img_idx += page_size;
            }
        }

        function append_page(start_idx, page_size, card_obj) {
            // make sure we don't exceed the number of card images in this Card
            let final_idx = start_idx + page_size;
            if (final_idx >= card_obj.img_count) {
                final_idx = card_obj.img_count;
            }

            // insert up to page_size card images into the modal
            for (let i = start_idx; i < final_idx; i++) {
                let card_item = card_obj.cards[i];
                let dom_id = card_obj.cards[i].identifier;
                let slot_num = i + 1;

                // copy the base grid card sitting in the dom and enable visibility
                let card_elem = document.getElementById("basecard-grid").cloneNode(true);
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

                // stick into dom under the grid container, and instantiate the CardGrid
                grid_container.appendChild(card_elem);
                let new_card = new CardGrid(card_item, dom_id, slot_num, card_obj);
            }
        }

        // reference to grid image container
        let grid_container = document.getElementById("grid-container");

        // clear out any existing rows from the table ("destroy all children" lmao)
        grid_container.innerHTML = "";

        // unbind any scroll events previously bound to this modal

        let grid_modal = $("#gridSelectModal");
        grid_modal.off("scroll");

        // if the number of images in this Card exceeds the page size, load in one page of images, and set up
        // an event listener on scrolling to the bottom of the modal to load in subsequent pages
        if (this.img_count > page_size) {
            grid_modal.on("scroll", chk_scroll.bind(this));
            append_page(0, page_size, this);
            grid_img_idx = page_size;
        } else {
            // if we have less than a page of results, just insert all of the images
            append_page(0, this.img_count, this);
        }
    }

    setup_card(cards, query, dom_id, slot, face, req_type, group, selected_img) {
        // array of card image obj's
        // each card image obj has properties: drive ID, name, source, DPI
        this.cards = cards;

        // other info
        this.query = query;
        if (query.length > 0 && query.toLowerCase().slice(0, 2) === "t:") {
            this.query = query.slice(2);
            // TODO: req_type = token?
        }
        this.slot = slot;
        this.face = face;
        this.group = group;
        this.locked = false;
        this.img_idx = 0;
        this.img_count = cards.length;
        this.dom_id = dom_id;
        this.req_type = req_type;

        // store references to the card's html elements
        this.pe = document.getElementById(this.dom_id)
        this.elem_name = document.getElementById(this.dom_id + "-mpccard-name");
        this.elem_source = document.getElementById(this.dom_id + "-mpccard-source");
        this.elem_slot = document.getElementById(this.dom_id + "-mpccard-slot");
        this.elem_img = document.getElementById(this.dom_id + "-card-img");
        this.elem_img_prev = document.getElementById(this.dom_id + "-card-img-prev");
        this.elem_img_next = document.getElementById(this.dom_id + "-card-img-next");
        this.elem_prev = document.getElementById(this.dom_id + "-prev");
        this.elem_next = document.getElementById(this.dom_id + "-next");
        this.elem_padlock = document.getElementById(this.dom_id + "-padlock");
        this.elem_remove = document.getElementById(this.dom_id + "-remove");

        // for more than one search result, allow users to click on the counter to bring up the grid img selector
        this.card_counter = document.getElementById(this.dom_id + "-mpccard-counter");
        this.card_counter_btn = document.getElementById(this.dom_id + "-mpccard-counter-btn");

        this.reset();

        this.elem_counter = this.card_counter;
        if (this.img_count > 1) {
            this.elem_counter = this.card_counter_btn;
        }
        this.elem_counter.style.display = "";

        // handy for updating the card later on
        this.empty = this.img_count === 0;

        // set up html elements to fit 1st card in set
        if (selected_img !== "") {
            // switch to this image ID
            this.select_id(selected_img);
        }

        // attach this object to the parent element
        $(this.pe).data("obj", this);

        // click on thumbnail for detailed view
        if (!this.empty) {
            if (this.req_type !== "back" | this.slot === "-") {
                this.elem_counter.style.visibility = "visible";
            }
            $(this.elem_img).on('click', function () {this.open_detailed_view()}.bind(this));
        }

        if (this.req_type == "back") {
            this.locked = true;
            this.group = 1;
        }

        // enable padlock for locking groups other than cardback
        if (this.group > 1 && cards.length > 1) {
            this.elem_padlock.style.display = "";
            $(this.elem_padlock).on('click', function () {this.toggle_lock()}.bind(this));
        }

        // set slot name + remove card btn + set up in-place search
        if (this.slot != "-") {
            this.elem_slot.innerHTML = "Slot " + (parseInt(this.slot) + 1).toString();

            this.elem_remove.style.display = "";
            let elem_remove = $(this.elem_remove);
            elem_remove.off("click");
            elem_remove.on('click', function () {this.remove_card()}.bind(this));

            this.elem_name.setAttribute("contentEditable", "true");
            $(this.elem_name).keydown(function (e) {
                if (e.keyCode === 13) {
                    let search_query = this.elem_name.innerText;
                    this.search_in_place(search_query);
                }
            }.bind(this));
        } else {
            this.elem_slot.innerHTML = "Cardback";
        }
        // enable version picker
        if (this.img_count > 1 & (this.slot == "-" | this.req_type != "back")) {
            this.elem_prev.style.visibility = "visible";
            this.elem_next.style.visibility = "visible";

            $(this.elem_prev).on('click', function () {this.update_idx(-1)}.bind(this));
            $(this.elem_next).on('click', function () {this.update_idx(1)}.bind(this));
            $(this.elem_counter).on('click', function () {this.open_grid_view()}.bind(this));
        }

        $(this.elem_img).one('load', function () {
            let card_obj = $(this.parentElement.parentElement).data("obj");
            card_obj.load_thumbnails();
        })

        // de-focus the query div
        $(this.elem_name).blur();
        window.getSelection().removeAllRanges();

        this.update_card();

        // wait for first image to complete loading before fading in
        $(this.elem_img).on("load", function () {this.fade_in()}.bind(this));
    }

    load_thumbnails() {
        if (!this.empty) {
            // some search results were found - use info from currently selected image variant
            // load the previous and next images for a smooth slideshow
            // keep them loaded by changing the src of visible img elements, but they sit behind the main
            // element due to z-index
            this.elem_img.src = this.cards[wrap0(this.img_idx, this.img_count)].small_thumbnail_url;

            // respect the length of the returned results
            if (this.img_count > 1) {
                this.elem_img_prev.src = this.cards[wrap0(this.img_idx - 1, this.img_count)].small_thumbnail_url;

                if (this.img_count > 2) {
                    this.elem_img_next.src = this.cards[wrap0(this.img_idx + 1, this.img_count)].small_thumbnail_url;
                }
            }
        } else {
            // this.elem_counter.style.display = "none";
            // no search results - update image src to blank image
            this.elem_img.src = "/static/cardpicker/blank.png";
        }
    }

    search_in_place(search_query) {
        let search_query_trimmed = search_query.trim()

        // animating the opacity instead of using fadeOut so things stay in place
        $(this.pe).css("pointer-events", "none");

        // disable hovering on the parent element temporarily while we bring up the modal
        this.pe.classList.remove("mpccard-hover");

        // callback function when the card finishes fading out, in the context of this Card object
        $(this.pe).animate({opacity: 0}, 250, function () {
            // first, if this card is in a lock group, remove it from the group
            if (this.group > 0) {
                groups[this.group].delete(this.dom_id);
            }

            let search_type = "";
            let common_back_id = "";
            if ((search_query_trimmed === "" || search_query_trimmed === null) && this.face === "back") {
                search_type = "back";
                // specify common cardback ID
                common_back_id = $("#slot--back").data("obj").get_curr_img().identifier;
            }

            // query elasticsearch for info w/ the new search query and pass the current card slot
            search_api(drive_order, fuzzy_search, search_query_trimmed, [parseInt(this.slot), ""], this.face, this.dom_id, search_type, 0, common_back_id);
        }.bind(this));
    }

    update_card() {
        // update visual elements that change between image variants
        let curr_title = this.query;
        let curr_source = "Your Search Query";

        if (!this.empty) {
            // some search results were found - use info from currently selected image variant
            curr_title = this.get_curr_img().name;
            curr_source = format_source(this.get_curr_img().source_verbose, this.get_curr_img().dpi)
        }

        // update image name
        this.elem_name.innerHTML = curr_title;

        // update source and dpi
        this.elem_source.innerHTML = curr_source;

        // update selected image/total
        this.elem_counter.innerHTML = (this.img_idx + 1).toString() + "/" + this.img_count.toString();

        this.load_thumbnails();
    }
}

export class CardRecent extends CardBase {
    // a stripped-down version of the Card class, with one image, and which isn't interactive except for
    // being able to open the detailed view
    constructor(card, dom_id) {
        super([card], null, dom_id, null, null, null, null, null);
    }

    setup_card(cards, query, dom_id, slot, face, req_type, group, selected_img) {
        // array of card image obj's
        // each card image obj has properties: drive ID, name, source, DPI
        this.cards = cards;
        this.img_idx = 0;
        this.dom_id = dom_id;
        this.req_type = ""

        // store references to the card's html elements
        this.pe = document.getElementById(this.dom_id)
        this.elem_name = document.getElementById(this.dom_id + "-mpccard-name");
        this.elem_source = document.getElementById(this.dom_id + "-mpccard-source");
        this.elem_slot = document.getElementById(this.dom_id + "-mpccard-slot");
        this.elem_img = document.getElementById(this.dom_id + "-card-img");

        // attach this object to the parent element
        $(this.pe).data("obj", this);

        // insert things
        this.elem_name.innerText = cards[0].name;
        this.elem_source.innerText = format_source(cards[0].source_verbose, cards[0].dpi);
        this.elem_slot.innerText = cards[0].date;

        // load thumbnails and set up fade in
        this.load_thumbnails();
        $(this.elem_img).one('load', function () {this.fade_in()}.bind(this));
    }

    load_thumbnails() {
        this.elem_img.src = this.cards[0].small_thumbnail_url;

        // add click event to thumbnail to reveal detailed info about card
        let elem_img = $(this.elem_img)
        elem_img.off('click');
        elem_img.on('click', function () {this.open_detailed_view()}.bind(this));
    }
}

export class CardGrid extends CardRecent {
    // a stripped-down version of the Card class, with one image, and which isn't interactive except for
    // being able to click on the thumbnail to select this image for the parent card
    constructor(card, dom_id, slot_num, card_obj) {
        super(card, dom_id);
        this.slot = slot_num;
        this.card_obj = card_obj;
        this.elem_slot.innerText = "Option " + this.slot.toString();
    }

    open_detailed_view() {
        // this function is called open_detailed_view bc that's bound to clicking on the thumbnail,
        // but this will really select this image for the card
        this.card_obj.set_idx(this.slot - 1);
        this.card_obj.load_thumbnails();
        Modal.getOrCreateInstance('#gridSelectModal').hide();
    }
}
