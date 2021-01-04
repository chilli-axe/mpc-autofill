# mpc-autofill
Automating MakePlayingCards's online ordering system.

The below guide describes the procedure for setting up the web component. If you're here to download the clientside program, check the Releases tab.

# Requirements
## Web application:
The following Python modules:
* `Django`
* `django-user-agents`
* `elasticsearch`
* `django-elasticsearch-dsl` and `elasticsearch-dsl`
* `google-api-python-client`, `google-auth-httplib2` and `google-auth-oauthlib`
* `django-crispy-forms`
* `defusedxml`

Other:
* [Bootstrap Superhero](https://bootswatch.com/superhero/)
* Elasticsearch - I'm using `7.10.1`
* A Google account with the desired Google Drives to index with the site added as shared Drives

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
2. In the same directory as the repo, create a folder called `staticroot` - by default, the database updater stores card images here
3. Deploy the Django project (I'm using DigitalOcean for Ubuntu) with a webserver (I'm using Apache) and serve static files with another webserver if you want (I was previously using nginx but now I just serve static files with Apache as well)
4. Run Elasticsearch, preferably as a service to ensure it always runs in the background
5. Set up your Google Drive credentials in the `MPCAutofill` directory - you should end up with a `credentials.json` file and a `token.pickle` file
6. Run the database update command `python manage.py update_database`, to populate the database and search engine index based on the state of linked Drives
7. Create a cronjob to periodically run this command, to ensure MPC Autofill reflects the current state of the linked Drives
8. Deploy two Google Script according to the code specified in `autofill.py` and adjust the URLs in that script to point to your GS endpoints
