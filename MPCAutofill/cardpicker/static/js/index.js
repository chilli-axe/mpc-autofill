// set the heights of the two divs containing the textarea to 100% here rather than fucking around with crispy
function index_on_load() {
    let textarea_elem = document.getElementById("id_card_list");
    textarea_elem.parentElement.style.height = "100%";
    textarea_elem.parentElement.parentElement.style.height = "100%";

    $('#cardinput, #input_csv, #input_xml, #input_link').submit(function (eventObj) {
        // user is submitting card input form - grab the order of selected drives and attach it to the form as a
        // hidden input
        let input_drives = $("<input>", {type: "hidden", name: "drive_order", value: get_drive_order()});
        $(this).append(input_drives)
        let input_fuzzy_search = $("<input>", {
            type: "hidden",
            name: "fuzzy_search",
            value: document.getElementById("searchtype").checked
        });
        $(this).append(input_fuzzy_search)
        return true;
    });

    // save search settings to cookie when closing the modal
    $('#selectDrivesModal').on('hidden.bs.modal', save_search_settings);
    load_search_settings();
    $("#blogs").slick({
        infinite: true,
        arrows: false,
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        responsive: [
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 1,
                }
            }
        ]
    });
}

function save_search_settings() {
    let settings = new Object;
    // settings["drives"] = new Object;
    settings["drives"] = []

    // save search mode settings
    settings["fuzzy_search"] = "off";
    if (document.getElementById("searchtype").checked) {
        settings["fuzzy_search"] = "on";
    }

    // save drive order and enabled/disabled status
    let drive_elements = document.getElementsByClassName("drivesource");
    for (let i = 0; i < drive_elements.length; i++) {
        let drive_enabled = "off";
        if (drive_elements[i].checked) {
            drive_enabled = "on";
        }
        settings["drives"].push([drive_elements[i].id, drive_enabled])
    }

    Cookies.set('search_settings', JSON.stringify(settings), {expires: 365});
}

function load_search_settings() {
    // Cookies.remove('search_settings');
    let settings = Cookies.get('search_settings');
    if (settings !== undefined) {
        settings = JSON.parse(settings);

        let drives = settings["drives"];
        let fuzzy_search = settings["fuzzy_search"];

        // maintain a set of all drives loaded into the page for making sure any new drives get inserted at the bottom
        let all_drive_elems = document.getElementsByClassName("drivesource");
        let all_drives = new Set();
        for (let i = all_drive_elems.length - 1; i >= 0; i--) {
            all_drives.add(all_drive_elems[i].id);
        }

        // reorder the drive table elements according to the cookie by inserting them all after the first one
        // in the cookie (in reverse order)
        $("#" + drives[0][0]).bootstrapToggle(drives[0][1]);
        let first_drive_row = $("#" + drives[0][0] + "-row");
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
        let last_drive_row = $("#" + drives[drives.length - 1][0] + "-row");
        all_drives.forEach(drive => $("#" + drive + "-row").insertAfter(last_drive_row));

        $("#searchtype").bootstrapToggle(fuzzy_search);
    }
}

function get_drive_order() {
    // get checkbox elements from dom, in order
    let drive_elements = document.getElementsByClassName("drivesource");
    let drives = [];
    // for each drive, if it's enabled, add its key to the output list
    for (let i = 0; i < drive_elements.length; i++) {
        if (drive_elements[i].checked) {
            drives.push(drive_elements[i].dataset.key)
        }
    }
    // convert to string when outputting
    return drives.toString();
}

function toggle_checkboxes() {
    // get checkbox elements from dom, in order
    let driveElements = document.getElementsByClassName("drivesource");
    var enableDrives = 'on';
    // for each drive, check if it's enabled, and if it is, we'll be disabling drives here
    for (let i = 0; i < driveElements.length; i++) {
        if (driveElements[i].checked) {
            enableDrives = 'off';
            break;
        }
    }
    // for each drive, set its checkedness
    for (let i = 0; i < driveElements.length; i++) {
        $(driveElements[i]).bootstrapToggle(enableDrives);
    }
}