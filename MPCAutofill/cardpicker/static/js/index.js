// set the heights of the two divs containing the textarea to 100% here rather than fucking around with crispy
document.getElementById("id_body").onload = function () {
    let textarea_elem = document.getElementById("id_card_list");
    textarea_elem.parentElement.style.height = "100%";
    textarea_elem.parentElement.parentElement.style.height = "100%";

    $('#cardinput, #input_csv, #input_xml').submit(function (eventObj) {
        // user is submitting card input form - grab the order of selected drives and attach it to the form as a
        // hidden input
        let input = $("<input>", {type: "hidden", name: "drive_order", value: driveOrder()});
        $(this).append(input)
        return true;
    });
}

function driveOrder() {
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

function toggleCheckboxes() {
    // get checkbox elements from dom, in order
    let driveElements = document.getElementsByClassName("drivesource");
    var enableDrives = true;
    // for each drive, check if it's enabled, and if it is, we'll be disabling drives here
    for (let i = 0; i < driveElements.length; i++) {
        if (driveElements[i].checked) {
            enableDrives = false;
            break;
        }
    }
    // for each drive, set its checkedness
    for (let i = 0; i < driveElements.length; i++) {
        driveElements[i].checked = enableDrives;
    }
}