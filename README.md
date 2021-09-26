# mpc-autofill
Automating MakePlayingCards's online ordering system.

The below guide describes the procedure for setting up the web component. If you're here to download the clientside program, check the Releases tab.

# Requirements
`requirements.txt` for the web application and local tool combined.

* Python3.8+
* Elasticsearch (probably easiest with Docker)
* A Google account

# Setup
#### <em>All steps with the prefix [PROD] are only needed if you are deploying this web app in a production environment. For running the application locally or for development, you can skip these steps.</em>
1. Clone this repo somewhere on your server/local computer. This will be referred to as the `$working_directory`.
2. If you are using an IDE to run the Django commands and are NOT using Windows: go to the `$working_directory/.run` directory and for each XML file delete the option `SDK_HOME`
3. Add the file `$working_directory/MPCAutofill/MPCAutofill/.env` to edit any environment variables used in `$working_directory/MPCAutofill/MPCAutofill/settings.py`.  
   IN ORDER TO RUN THE APP LOCALLY, YOU MUST ADD `DJANGO_DEBUG=on` TO THE `$working_directory/MPCAutofill/MPCAutofill/.env` FILE
4. **[PROD]** In the `$working_directory`, create a folder called `staticroot` for static assets
5. **[PROD]** Deploy the Django project (I'm using DigitalOcean for Ubuntu) with a webserver (I'm using Apache) and serve static files with another webserver if you want (I was previously using nginx but now I just serve static files with Apache as well)
6. Install Elasticsearch based on your OS, or with Docker ([Installation Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html))
   1. It might make the most sense to unzip the Elasticsearch directory into your `$working_directory`
   2. Optionally, add the executables to your PATH for easy terminal access (add `location-of-package/elasticsearch-<VERSION_NUM>/bin` to your PATH)
7. Run Elasticsearch
   1. Use the executable indicated in your OS's Installation Guide, optionally running it as a daemon.
   2. Test that Elasticsearch is running by querying the local instance. For example: `wget -qO- http://localhost:9200/`
8. Set up your Google Drive credentials using a Google Drive service account. For each step, only follow the instructions for the given section, then return and complete the next step. The linked tutorial is slightly out of date, but it is the most complete tutorial around.
   1. [Step 1](https://help.talend.com/r/E3i03eb7IpvsigwC58fxQg/uEUUsDd_MSx64yoJgSa1xg) - NOTE: The project name, product name, and Application type don't matter for just running the tool locally.
   2. [Step 2](https://help.talend.com/r/E3i03eb7IpvsigwC58fxQg/ol2OwTHmFbDiMjQl3ES5QA) - NOTE: The JSON file you download at the end of this step is named something slightly different from what the application expects. Make sure to rename it.
   3. Rename the saved JSON file to `client_secrets.json` and move it to: `$working_directory/MPCAutofill`
9. Update the `$working_directory/MPCAutofill/drives.csv` spreadsheet with links to public Google Drives with MPC ready images
   1. Do not edit the first row of the spreadsheet
   2. Heading Reference (key = Name of Drive Owner, drive_id = 33 character Gdrive identifier, drive_public = TRUE, description = Description of what's in that drive)
   3. Drive ID is everything after `https://drive.google.com/drive/u/0/folders/` in the Gdrive link
11. Install the main dependencies using a python virtual environment (this entire step is often automatically handled by your IDE)
    1. To initialize the environment, create the virtual environment library using `python3 -m venv $working_directory/venv`  
    For Windows the command will be  `py -m venv $working_directory\venv`
    2. Activate the environment using your OS specific command in the table found in this section of the docs: [Scroll to the table](https://docs.python.org/3.8/library/venv.html#creating-virtual-environments)
    3. In the `$working_directory` with the virtual environment active, run the command `pip3 install -r requirements.txt` to install all requirements listed in `$working_directory/requirements.txt`
12. In the `$working_directory/MPCAutofill`, run the command `python manage.py migrate` to ensure the database tables reflect any Django model changes.
13. In the `$working_directory/MPCAutofill`, run the command `python manage.py update_dfcs` to synchronise the double-faced cards table with Scryfall.
14. In the `$working_directory/MPCAutofill`, run the command `python manage.py import_sources` to sync sources in `$working_directory/MPCAutofill/drives.csv` to the database (optionally specifying a particular drive to sync with `-d <drivename>`)
15. (Elasticsearch must be running for this script to work)  
   In the `$working_directory/MPCAutofill`, run the command `python manage.py update_database` to populate the database with cards from the sources loaded with `import_sources`
15. Optionally, create a cronjob to periodically run the database updater command, to ensure MPC Autofill reflects the current state of the linked Drives, and another cronjob to periodically synchronise the double-faced cards table with Scryfall:
```
0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1
0 0 * * SUN bash /root/mpc-autofill/sync_dfcs
```
16. **[PROD]** Deploy two Google Script according to the code specified in `autofill.py` and adjust the URLs in that script to point to your GS endpoints
