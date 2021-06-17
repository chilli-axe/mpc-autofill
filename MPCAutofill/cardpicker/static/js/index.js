// set the heights of the two divs containing the textarea to 100% here rather than fucking around with crispy
document.getElementById("id_body").onload = function () {
    let textarea_elem = document.getElementById("id_card_list");
    textarea_elem.parentElement.style.height = "100%";
    textarea_elem.parentElement.parentElement.style.height = "100%";

    $('#cardinput, #input_csv, #input_xml').submit(function (eventObj) {
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
    let driveElements = document.getElementsByClassName("drivesource");
    let drives = []
    // for each drive, if it's enabled, add its id to the output list
    for (let i = 0; i < driveElements.length; i++) {
        if (driveElements[i].checked) {
            drives.push(driveElements[i].id)
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