# mpc-autofill
Automating MakePlayingCards's online ordering system.

The below guide describes the procedure for setting up the web component. If you're here to download the clientside program, check the Releases tab.

# Requirements
Python modules:
* `Django`
* `django-user-agents`
* `elasticsearch`, version between 5 and 6
* `django-haystack` 3.0b2
* `google-api-python-client`, `google-auth-httplib2` and `google-auth-oauthlib`
* `django-crispy-forms`
* `colorama`
* `webdriver_manager`
* `selenium`
* `numpy`
* `tqdm`

Other:
* Elasticsearch 5.6.10 - `django-haystack` only supports up to V5 of Elasticsearch unfortunately
* A Google account with the desired Google Drives to index with the site added as shared Drives

# Setup
1. Clone this repo somewhere on your server
2. In the same directory as the repo, create a folder called `staticroot` - by default, the database updater stores card images here
3. Deploy the Django project (I'm using AWS Lightsail for Ubuntu) with a webserver (I'm using Apache) and serve static files with another webserver (I'm using nginx)
4. Run Elasticsearch, preferably as a service to ensure it always runs in the background
5. Run `update_database.py`, then `python manage.py rebuild_index --noinput`, to populate the database and search engine index based on the state of linked Drives
6. Create a cronjob to periodically run those two commands in succession, to ensure MPC Autofill reflects the current state of the linked Drives
