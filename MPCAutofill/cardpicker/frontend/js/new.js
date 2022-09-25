require("./base.js");
import { base_on_load } from "./base.js";
import { CardRecent } from "./card.js";

function build_new_cards(source, data, more) {
  // iterate over the search results
  for (let i = 0; i < data.length; i++) {
    let card_item = data[i];
    let dom_id = card_item.identifier;

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
      card_elem.getElementsByClassName(class_ids[i])[0].id =
        dom_id + "-" + class_ids[i];
    }

    // stick into dom under the source's card container, and instantiate the Card
    document.getElementById(source + "-container").appendChild(card_elem);
    let new_card = new CardRecent(card_item, dom_id);

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

export function load_new_cards(source) {
  // ajax function to ask the server for a page on the What's New page (kek) and stick it into the dom
  $.ajax({
    type: "POST",
    url: "/ajax/getnew/",
    data: {
      source: source,
      page: pages[source],
    },
    success: function (data) {
      // use the search results to stick the new page into the dom
      build_new_cards(
        source,
        data.results[source].hits,
        data.results[source].more
      );
    },
    error: function () {
      // callback here in 5 seconds
      // alert("fucked up");
    },
  });
}

export function new_on_load() {
  base_on_load(exception);

  for (const [source, info] of Object.entries(context)) {
    pages[source] = 0;
    build_new_cards(source, info.hits, info.more);
  }
}
