// set the heights of the two divs containing the textarea to 100% here rather than fucking around with crispy
function on_load(exception) {
    let textarea_elem = document.getElementById("id_card_list");
    textarea_elem.parentElement.style.height = "100%";
    textarea_elem.parentElement.parentElement.style.height = "100%";

    $('#cardinput, #input_csv, #input_xml, #input_link').submit(function (eventObj) {
        // user is submitting card input form - grab the order of selected drives and attach it to the form as a
        // hidden input
        let input_drives = $("<input>", {type: "hidden", name: "drive_order", value: get_drive_order()});
        $(this).append(input_drives)
        let input_fuzzy_search = $("<input>", {type: "hidden", name: "fuzzy_search", value: document.getElementById("searchtype").checked});
        $(this).append(input_fuzzy_search)
        return true;
    });
    let cookie_toast = $('#cookieToast');
    cookie_toast.on('hide.bs.toast', cookie_toast_hidden);
    cookie_toast.on('show.bs.toast', cookie_toast_shown);
    // Cookies.remove('ga_disabled')
    if (Cookies.get('ga_disabled') === undefined) {
        cookie_toast.toast('show');
    }

    if (exception !== "" && exception !== undefined && exception !== null) {
        // set up error toast and display it
        handle_error(exception);
    }

    // save search settings to cookie when closing the modal
    $('#selectDrivesModal').on('hidden.bs.modal', save_search_settings);
    load_search_settings();
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

    Cookies.set('search_settings', JSON.stringify(settings), { expires: 365 });
}

function load_search_settings() {
    let settings = Cookies.get('search_settings');
    if (settings !== undefined) {
        settings = JSON.parse(settings);

        let drives = settings["drives"];
        let fuzzy_search = settings["fuzzy_search"];

        // maintain a set of all drives loaded into the page for making sure any new drives get inserted at the bottom
        let all_drive_elems = document.getElementsByClassName("drivesource");
        let all_drives = new Set();
        for (let i=all_drive_elems.length-1; i>=0; i--) {
            all_drives.add(all_drive_elems[i].id);
        }

        // reorder the drive table elements according to the cookie by inserting them all after the first one
        // in the cookie (in reverse order)
        $("#" + drives[0][0]).bootstrapToggle(drives[0][1]);
        let first_drive_row = $("#" + drives[0][0] + "-row");
        all_drives.delete(drives[0][0]);
        for (let i=drives.length-1; i>0; i--) {
            $("#" + drives[i][0]).bootstrapToggle(drives[i][1]);
            $("#" + drives[i][0] + "-row").insertAfter(first_drive_row);
            all_drives.delete(drives[i][0]);
        }

        // any drives left in all_drives at this point were added to the site between now and when the user's
        // search settings cookie was last saved
        // stick these users onto the end - note that the drives were inserted into the set in reverse order,
        // meaning that these will be insertAfter'd in reverse order, which orders the elements correctly
        let last_drive_row = $("#" + drives[drives.length-1][0] + "-row");
        all_drives.forEach(drive => $("#" + drive + "-row").insertAfter(last_drive_row));

        $("#searchtype").bootstrapToggle(fuzzy_search);
    }
}

function cookie_toast_shown() {
    this.style.zIndex = "99999";
}

function cookie_toast_hidden() {
    this.style.zIndex = "0";
    if (Cookies.get('ga_disabled') === undefined) {
        Cookies.set('ga_disabled', 'false', { expires: 365 })
    }
}

function cookie_toast_opt_in() {
    Cookies.set('ga_disabled', 'false', { expires: 365 });
    $('#cookieToast').toast('hide');
}

function cookie_toast_opt_out() {
    Cookies.set('ga_disabled', 'true', { expires: 365 });
    window['ga-disable-'.concat(my_gtag)] = true;
    $('#cookieToast').toast('hide');
}

function get_drive_order() {
    // get checkbox elements from dom, in order
    let drive_elements = document.getElementsByClassName("drivesource");
    let drives = [];
    // for each drive, if it's enabled, add its id to the output list
    for (let i = 0; i < drive_elements.length; i++) {
        if (drive_elements[i].checked) {
            drives.push(drive_elements[i].id)
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