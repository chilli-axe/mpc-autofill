function base_on_load() {
    let cookie_toast = $('#cookieToast');
    cookie_toast.on('hide.bs.toast', cookie_toast_hidden);
    cookie_toast.on('show.bs.toast', cookie_toast_shown);
    // Cookies.remove('ga_disabled')
    if (Cookies.get('ga_disabled') === undefined) {
        cookie_toast.toast('show');
    }

    let error_toast = $('#errorToast');
    error_toast.on('hide.bs.toast', error_toast_hidden);
    error_toast.on('show.bs.toast', error_toast_shown);
    if (exception !== "" && exception !== undefined && exception !== null) {
        // set up error toast and display it
        handle_error(exception);
    }
}

function handle_error(exception) {
    let error_toast = $("#errorToast");
    if (exception !== "" && exception !== undefined && exception !== null) {
        document.getElementById("error_message_body").textContent = exception;
    } else {
        document.getElementById("error_message_paragraph").textContent = "Sorry about that! If the issue persists, please let me know on Reddit or Discord.";
    }
    error_toast.toast("show");
}

function error_toast_shown() {
    this.style.zIndex = "99999";
}

function error_toast_hidden() {
    this.style.zIndex = "0";
    if (Cookies.get('ga_disabled') === undefined) {
        Cookies.set('ga_disabled', 'false', { expires: 365 })
    }
}

function cookie_toast_shown() {
    this.style.zIndex = "99999";
}

function cookie_toast_hidden() {
    this.style.zIndex = "-1";
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