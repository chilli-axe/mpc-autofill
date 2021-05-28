# mpc-autofill
Automating MakePlayingCards's online ordering system.

The below guide describes the procedure for setting up the web component. If you're here to download the clientside program, check the Releases tab.

# Requirements
`requirements.txt` for the web application and local tool combined exists in the repo as well.

## Web application:
The following Python modules:
* `Django`
* `django-user-agents`
* `psycopg2`
* `python-Levenshtein`
* `google-api-python-client`, `google-auth-httplib2` and `google-auth-oauthlib`
* `django-crispy-forms`
* `defusedxml`
* `django-bulk-sync`
* `django-user-agents`
* `django-elasticsearch-dsl` and `elasticsearch-dsl`

Other:
* [Bootstrap Superhero](https://bootswatch.com/superhero/)
* Elasticsearch (probably easiest with Docker)
* A Google account

## Local tool:
The following Python modules:
* `colorama`
* `webdriver_manager`
* `selenium`
* `numpy`
* `tqdm`
* `pyinstaller` for generating executables

# Setup
1. Clone this repo somewhere on your server
2. In the same directory as the repo, create a folder called `staticroot` for static assets
3. Deploy the Django project (I'm using DigitalOcean for Ubuntu) with a webserver (I'm using Apache) and serve static files with another webserver if you want (I was previously using nginx but now I just serve static files with Apache as well)
4. Run Elasticsearch
5. Set up your Google Drive credentials in the `MPCAutofill` directory - you should end up with a `credentials.json` file and a `token.pickle` file
6. Run the command `manage.py import_sources` to sync sources in `drives.csv` to database, and `manage.py update_database` to populate the database (optionally specifying a particular drive to sync with `-d <drivename>`)
7. Create a cronjob to periodically run the database updater command, to ensure MPC Autofill reflects the current state of the linked Drives, and another cronjob to periodically synchronise the double-faced cards table with Scryfall:
* `0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1`
* `0 0 * * SUN bash /root/mpc-autofill/sync_dfcs`
8. Deploy two Google Script according to the code specified in `autofill.py` and adjust the URLs in that script to point to your GS endpoints
