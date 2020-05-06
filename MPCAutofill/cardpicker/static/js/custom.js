// keep track of the slide indexes of each individual card
var indexMap = new Map();

function plusDivs(element, n) {
  // get all images in the current slideshow
  curr_id = element.parentElement.parentElement.id;
  var i;
  var slideshow = document.getElementById(curr_id);
  var x = slideshow.getElementsByClassName("card-img");

  // if the current id isn't in the map yet, initialise it to 1
  // otherwise, retrieve its value
  var idx = 1;
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
  showDivs(curr_id, x, idx);
}

function showDivs(curr_id, x, idx) {
  // set all images in slideshow to invisible,
  // then set the desired one to visible
  for (i = 0; i < x.length; i++) {
    x[i].style.display = "none";
  }
  x[idx - 1].style.display = "inline-block";
  indexMap.set(curr_id, idx);
}

function getAllIndexes(arr, val) {
    var indexes = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indexes.push(i);
    return indexes;
}

function toggleFrontBack(element) {
  // when the card face button is swapped, swap the faces
  var currentClass = element.parentElement.parentElement;

  // find the element of the other face
  var classes = ["front", "back"];
  var currentClassIdSplit = currentClass.id.split("-");
  var desiredClassId = currentClassIdSplit[0] + "-" + classes[Math.abs(classes.indexOf(currentClassIdSplit[1]) - 1)];
  var desiredClass = document.getElementById(desiredClassId);

  // Set the Z-index of the clicked face to 1, and the index of the other face to 0
  currentClass.parentElement.style.zIndex = "0";
  desiredClass.parentElement.style.zIndex = "1";

  // Set the clicked face's arrows to visible, and the arrows of the other to invisible
  currentClass.getElementsByClassName("prevNextBtns")[0].style.display = "none";
  desiredClass.getElementsByClassName("prevNextBtns")[0].style.display = "initial";
}

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function generateXml() {
  // create xml document
  var doc = document.implementation.createDocument("", "", null);
  var e = document.getElementById("cardstockSelect");
  var selectedCardstock = e.options[e.selectedIndex].value;

  // top level XML doc element, attach everything to this
  var orderElem = doc.createElement("order");

  // order details - quantity, bracket, stock
  var detailsElem = doc.createElement("details");
  var qtyElem = doc.createElement("quantity");
  var bracketElem = doc.createElement("bracket");
  var stockElem = doc.createElement("stock");
  qtyElem.appendChild(doc.createTextNode(qty));
  bracketElem.appendChild(doc.createTextNode(bracket));
  stockElem.appendChild(doc.createTextNode(selectedCardstock));
  detailsElem.appendChild(qtyElem);
  detailsElem.appendChild(bracketElem);
  detailsElem.appendChild(stockElem);
  orderElem.appendChild(detailsElem);

  // add the card images for fronts and backs
  var faces = ["front", "back"];
  for (var j = 0; j < faces.length; j++) {
    var cardImages = {};
    // get all elements for this card face and loop over them
    var visibleImages = document.getElementsByClassName("card-img card-" + faces[j]);
    for (var i = 0; i < visibleImages.length; i++) {
      if (visibleImages[i].style.display !== "none") {
        // retrieve the visible face's google drive ID
        var src = visibleImages[i].src;
        src = src.slice(src.lastIndexOf("/") + 1, src.length - 4);
        // retrieve the card's slot number from the element ID
        var parentId = visibleImages[i].parentElement.id;
        var currentSlot = parseInt(parentId.slice(4, parentId.indexOf("-")));
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
      var faceElem = doc.createElement(faces[j] + "s");
      for (var key in cardImages) {
        var currentIndices = "[" + String(cardImages[key]) + "]";
        var cardElem = doc.createElement("card");
        var idElem = doc.createElement("id");
        var slotsElem = doc.createElement("slots");
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
  var defaultBacks = document.getElementsByClassName("card-back-default");
  for (var i = 0; i < defaultBacks.length; i++) {
    if (defaultBacks[i].style.display !== "none") {
      var src = defaultBacks[i].src;
      // trim off the excess filepath garbage to just retrieve the drive ID
      src = src.slice(src.lastIndexOf("/") + 1, src.length - 4);
      defaultBackElem.appendChild(doc.createTextNode(src));
      orderElem.appendChild(defaultBackElem);
      break;
    }
  }

  // attach everything to the doc
  doc.appendChild(orderElem);

  // serialise to XML
  var serialiser = new XMLSerializer();
  var xml = serialiser.serializeToString(doc);

  // download to the user
  download("cards.xml", xml);
}
