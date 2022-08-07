import Cookies from 'js-cookie';

import "bootswatch/dist/superhero/bootstrap.min.css"; // TODO: read theme from env var

// set up ajax to attach the CSRF token to all requests to the server
// lifted from https://docs.djangoproject.com/en/3.1/ref/csrf/#ajax
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


const csrftoken = getCookie('csrftoken');


function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});

export function handle_error(exc) {
    let error_toast = bootstrap.Toast.getOrCreateInstance("#errorToast");
    if (exc !== "" && exc !== undefined && exc !== null) {
        document.getElementById("error_message_body").textContent = exc;
    } else {
        document.getElementById("error_message_paragraph").textContent = "Sorry about that! If the issue persists, please let me know on Reddit or Discord.";
    }
    error_toast.show();
}

function error_toast_shown() {
    this.style.zIndex = "99999";
}

function error_toast_hidden() {
    this.style.zIndex = "-1";
    if (Cookies.get('ga_disabled') === undefined) {
        Cookies.set('ga_disabled', 'false', {expires: 365})
    }
}

function cookie_toast_shown() {
    this.style.zIndex = "99999";
}

function cookie_toast_hidden() {
    this.style.zIndex = "-2";
    if (Cookies.get('ga_disabled') === undefined) {
        Cookies.set('ga_disabled', 'false', {expires: 365})
    }
}


function base_on_load() {
    // gtag configuration
    if (Cookies.get('ga_disabled') === 'true') {
        window['ga-disable-'.concat(my_gtag)] = true;
    }
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '{{ GTAG }}');

    // cookie toast configuration
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

export function cookie_toast_opt_in() {
    Cookies.set('ga_disabled', 'false', {expires: 365});
    $('#cookieToast').toast('hide');
}

export function cookie_toast_opt_out() {
    Cookies.set('ga_disabled', 'true', {expires: 365});
    window['ga-disable-'.concat(my_gtag)] = true;
    $('#cookieToast').toast('hide');
}

window.addEventListener('load', base_on_load, false);
