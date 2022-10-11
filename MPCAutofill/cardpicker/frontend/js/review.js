/* global qty, groups, drive_order, fuzzy_search, order */

import "bootstrap5-toggle";
import Modal from "bootstrap/js/dist/modal";
import Tooltip from "bootstrap/js/dist/tooltip";
import {
  insert_data,
  update_qty,
  bracket,
  switch_faces,
  insert_xml,
  insert_text,
  insert_link,
} from "./search.js";
import { selectElementContents, trigger_download } from "./card.js";
import "bootstrap5-toggle/css/bootstrap5-toggle.min.css";
require("bootstrap/js/dist/dropdown");

require("./base.js"); // this css should be loaded last

function download(filename, text) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function generate_xml() {
  // create xml document
  const doc = document.implementation.createDocument("", "", null);
  const e = document.getElementById("cardstock-dropdown");
  const selectedCardstock = e.options[e.selectedIndex].value;

  // top level XML doc element, attach everything to this
  const orderElem = doc.createElement("order");

  // order details - quantity, bracket, stock
  const detailsElem = doc.createElement("details");
  const qtyElem = doc.createElement("quantity");
  const bracketElem = doc.createElement("bracket");
  const stockElem = doc.createElement("stock");
  const foil = document.getElementById("cardstock-foil");
  const foilElem = doc.createElement("foil");

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
  const cardback_id = $("#slot--back").data("obj").get_curr_img().identifier;

  // set up an object we can use to keep track of what to write to the XML
  const order_map = {};
  order_map.front = {};
  order_map.back = {};
  const num_imgs = { front: 0, back: 0 };

  // iterate over all cards in the order - fronts and backs, including common cardback on right panel
  const card_elems = document.getElementsByClassName("mpc-order");
  for (let i = 0; i < card_elems.length; i++) {
    // retrieve information about the current card object
    const curr_obj = $("#" + card_elems[i].id).data("obj");

    // only proceed if the card obj has any search results
    if (curr_obj.cards.length > 0) {
      const curr_id = curr_obj.get_curr_img().identifier;

      if (curr_id !== cardback_id) {
        // the card we're looking at isn't the common cardback, so we care about it
        const curr_face = curr_obj.face;
        if (order_map[curr_face][curr_id] === undefined) {
          // this image doesn't exist in the order map yet, so add it
          const curr_img = curr_obj.get_curr_img();
          const curr_name = curr_img.name + "." + curr_img.extension;
          order_map[curr_face][curr_id] = {
            id: curr_id, // image ID
            slots: [curr_obj.slot], // slot number
            name: curr_name,
            query: curr_obj.get_query(), // search query
          };
          // we found an image in this face
          num_imgs[curr_face] = 1;
        } else {
          // add this image's slot number to the existing info about this card
          order_map[curr_face][curr_id].slots.push(curr_obj.slot);
        }
      }
    }
  }

  // insert everything from the order map into XML elements
  for (const face in order_map) {
    if (num_imgs[face] > 0) {
      // this face has a nonzero number of things in it, so we should add to XML
      // (relevant for the back face, where we skip adding it to the XML if there are no special card backs)

      // create a parent element for this face
      const faceElem = doc.createElement(face + "s");

      for (const img in order_map[face]) {
        // add this Card to XML by first creating an element for it, then looping over its properties
        // and adding them too
        const cardElem = doc.createElement("card");
        for (const property in order_map[face][img]) {
          // add this property
          const thisElem = doc.createElement(property);
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
  const backElem = doc.createElement("cardback");
  backElem.appendChild(doc.createTextNode(cardback_id));
  orderElem.appendChild(backElem);

  // attach everything to the doc
  doc.appendChild(orderElem);

  // serialise to XML
  const serialiser = new XMLSerializer();
  const xml = serialiser.serializeToString(doc);

  // download to the user
  download("cards.xml", xml);
}

export function download_all() {
  // TODO: can we rewrite this to zip up the requested images?
  // TODO: or download individually without opening one billion windows?
  // get all Card objects using a set to avoid duplicates
  let card_set = new Set();
  $(".mpc-order").each(function () {
    const curr_obj = $(this).data("obj");
    // check if the Card is empty before trying to retrieve its current img ID
    if (!curr_obj.empty) {
      card_set = card_set.add(curr_obj.get_curr_img().download_link);
    }
  });

  // convert to array, then iterate over array and trigger download on each drive id
  const card_array = Array.from(card_set);
  for (let i = 0; i < card_array.length; i++) {
    trigger_download(card_array[i]);
  }
}

export function clear_text(text_field) {
  const textarea_elem = document.getElementById(text_field);
  textarea_elem.value = "";
}

export function remove_card() {
  const slot_to_remove = document.getElementById("removeCardId").slot_num;
  if (qty > 1) {
    // remove the Card from its lock group/s (if it's part of any) and delete its elements
    const faces = ["-front", "-back"];
    for (let i = 0; i < faces.length; i++) {
      const this_elem = $("#slot" + slot_to_remove.toString() + faces[i]);
      const this_obj = this_elem.data("obj");

      // if the Card object is in a group, remove it from that group
      if (this_obj.group > 0) {
        // the Card's dom ID will be sitting in the array groups[this_obj.group],
        // at index groups[this_obj.group].indexOf(this_obj.dom_id)
        groups[this_obj.group].delete(this_obj.dom_id);
      }

      // delete the dom element
      this_elem.remove();
    }

    update_qty(qty - 1);

    if (slot_to_remove !== qty) {
      // update the card slots on all cards after the one we just deleted
      for (let i = slot_to_remove; i < qty; i++) {
        $("#slot" + (i + 1).toString() + "-front")
          .data("obj")
          .update_slot(i);
        $("#slot" + (i + 1).toString() + "-back")
          .data("obj")
          .update_slot(i);
      }
    }
  }
  Modal.getOrCreateInstance("#removeCardModal").hide();
}

function set_cardstock(data) {
  document.getElementById("cardstock-dropdown").value = data.cardstock;
  if (data.foil === "true") {
    $(document.getElementById("cardstock-foil")).bootstrapToggle("on");
  }
}

function setup_toasts(toasts) {
  function setup_toast(toast_id) {
    const toast = $("#".concat(toast_id));
    toast.on("hide.bs.toast", function () {
      this.style.zIndex = "0";
    });
    toast.on("show.bs.toast", function () {
      this.style.zIndex = "99999";
    });
  }

  toasts.forEach((toast) => setup_toast(toast));
}

export function review_on_load() {
  setup_toasts(["maxCardsToast", "errorToast"]);
  set_cardstock(order);
  insert_data(drive_order, fuzzy_search, order);
  // enable tooltips
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new Tooltip(tooltipTriggerEl);
  });
}

export {
  switch_faces,
  insert_xml,
  insert_text,
  insert_link,
  selectElementContents,
};
