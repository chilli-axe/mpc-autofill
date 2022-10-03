import Cookies from "js-cookie";
import "bootstrap5-toggle";
import { base_on_load, handle_error } from "./base.js";
import "bootstrap5-toggle/css/bootstrap5-toggle.min.css";
require("bootstrap/js/dist/modal");

require("bootstrap/js/dist/dropdown");

require("jquery-ui/ui/widgets/sortable");
require("./base.js"); // this css should be loaded last

// #region search settings

function load_search_settings() {
  // maintain a set of all drives loaded into the page for making sure any new drives get inserted at the bottom
  const all_drive_elems = document.getElementsByClassName("drivesource");
  let all_drives = new Set();
  for (let i = all_drive_elems.length - 1; i >= 0; i--) {
    all_drives.add(all_drive_elems[i].id);
    $("#" + all_drive_elems[i].id).bootstrapToggle();
  }

  let settings = Cookies.get("search_settings");
  if (settings !== undefined) {
    settings = JSON.parse(settings);

    const drives = settings.drives;
    const fuzzy_search = settings.fuzzy_search;

    if (drives.length > 0) {
      // maintain a set of all drives loaded into the page for making sure any new drives get inserted at the bottom
      const all_drive_elems = document.getElementsByClassName("drivesource");
      const all_drives = new Set();
      for (let i = all_drive_elems.length - 1; i >= 0; i--) {
        all_drives.add(all_drive_elems[i].id);
      }

      // reorder the drive table elements according to the cookie by inserting them all after the first one
      // in the cookie (in reverse order)
      $("#" + drives[0][0]).bootstrapToggle(drives[0][1]);
      const first_drive_row = $("#" + drives[0][0] + "-row");
      all_drives.delete(drives[0][0]);
      for (let i = drives.length - 1; i > 0; i--) {
        $("#" + drives[i][0]).bootstrapToggle(drives[i][1]);
        $("#" + drives[i][0] + "-row").insertAfter(first_drive_row);
        all_drives.delete(drives[i][0]);
      }

      // any drives left in all_drives at this point were added to the site between now and when the user's
      // search settings cookie was last saved
      // stick these users onto the end - note that the drives were inserted into the set in reverse order,
      // meaning that these will be insertAfter'd in reverse order, which orders the elements correctly
      const last_drive_row = $("#" + drives[drives.length - 1][0] + "-row");
      all_drives.forEach((drive) =>
        $("#" + drive + "-row").insertAfter(last_drive_row)
      );
    }

    $("#searchtype").bootstrapToggle(fuzzy_search);
  }
}

function save_search_settings() {
  const settings = new Object();
  settings.drives = [];

  // save search mode settings
  settings.fuzzy_search = "off";
  if (document.getElementById("searchtype").checked) {
    settings.fuzzy_search = "on";
  }

  // save drive order and enabled/disabled status
  const drive_elements = document.getElementsByClassName("drivesource");
  for (let i = 0; i < drive_elements.length; i++) {
    let drive_enabled = "off";
    if (drive_elements[i].checked) {
      drive_enabled = "on";
    }
    settings.drives.push([drive_elements[i].id, drive_enabled]);
  }

  Cookies.set("search_settings", JSON.stringify(settings), { expires: 365 });
}

export function toggle_checkboxes() {
  // get checkbox elements from dom, in order
  const driveElements = document.getElementsByClassName("drivesource");
  let enableDrives = "on";
  // for each drive, check if it's enabled, and if it is, we'll be disabling drives here
  for (let i = 0; i < driveElements.length; i++) {
    if (driveElements[i].checked) {
      enableDrives = "off";
      break;
    }
  }
  // for each drive, set its checkedness
  for (let i = 0; i < driveElements.length; i++) {
    $(driveElements[i]).bootstrapToggle(enableDrives);
  }
}

function get_drive_order() {
  // get checkbox elements from dom, in order
  const drive_elements = document.getElementsByClassName("drivesource");
  const drives = [];
  // for each drive, if it's enabled, add its id to the output list
  for (let i = 0; i < drive_elements.length; i++) {
    if (drive_elements[i].checked) {
      drives.push(drive_elements[i].id);
    }
  }
  // convert to string when outputting
  return drives.toString();
}

function configure_form_submit_hooks() {
  $("#cardinput, #input_csv, #input_xml, #input_link").on(
    "submit",
    function (eventObj) {
      // user is submitting card input form - grab the order of selected drives and attach it to the form as a
      // hidden input
      const input_drives = $("<input>", {
        type: "hidden",
        name: "drive_order",
        value: get_drive_order(),
      });
      $(this).append(input_drives);
      const input_fuzzy_search = $("<input>", {
        type: "hidden",
        name: "fuzzy_search",
        value: document.getElementById("searchtype").checked,
      });
      $(this).append(input_fuzzy_search);
      return true;
    }
  );
}

// #endregion

// #region misc

function configure_textarea_height() {
  const textarea_elem = document.getElementById("id_card_list");
  textarea_elem.parentElement.style.height = "100%";
  textarea_elem.parentElement.parentElement.style.height = "100%";
}

function ping_elasticsearch() {
  // alert the user if the search engine is offline
  $.ajax({
    type: "POST",
    url: "/ajax/status/",
    success: function (data) {
      if (data.online === "false") {
        handle_error("The search engine is offline.");
      }
    },
  });
}

// #endregion

// #region form submission

export function input_link_submit() {
  $("#input_link").submit();
}

export function input_csv_submit() {
  $("#input_csv").submit();
}

export function input_xml_submit() {
  $("#input_xml").submit();
}

// #endregion

// this function is called in `index.html`
export function index_on_load() {
  base_on_load();

  configure_textarea_height();
  configure_form_submit_hooks();
  load_search_settings();
  // save search settings when closing the modal
  document
    .getElementById("selectDrivesModal")
    .addEventListener("hidden.bs.modal", save_search_settings);
  // $("#blogs").slick({  // TODO: replace with masonry
  //     infinite: true,
  //     arrows: false,
  //     slidesToShow: 4,
  //     slidesToScroll: 1,
  //     autoplay: true,
  //     autoplaySpeed: 3000,
  //     responsive: [
  //         {
  //             breakpoint: 992,
  //             settings: {
  //                 slidesToShow: 3,
  //             }
  //         },
  //         {
  //             breakpoint: 768,
  //             settings: {
  //                 slidesToShow: 2,
  //             }
  //         },
  //         {
  //             breakpoint: 576,
  //             settings: {
  //                 slidesToShow: 1,
  //             }
  //         }
  //     ]
  // });
  $("#drive-order-tbody").sortable();
  ping_elasticsearch();
}

window.addEventListener("load", index_on_load, false);
