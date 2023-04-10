# MPC Autofill Backend

# Preparation

Before the web application can be started, a couple of user files need to be prepared and copied to the right places.

## Step 1: Setup Google Service Account

If you are running MPCAutofill for the first time, you need to set up a Google Service Account first. Go to https://console.developers.google.com/ and create a new project. Then, navigate to Service Accounts, create a new one, go to "Manage Keys", add a new key while choosing the JSON format. Finally, copy the downloaded key into the sub-folder `MPCAutofill/client_secrets.json`.

Also, make sure your Google Drive API is enabled. Otherwise, all drive imports will fail! You can verify this by visiting the following website with your Google project id inserted at the end of the link: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=yourprojectid

## Step 2: Populate Google Drive CSV

You also need some Google Drives to be added to `MPCAutofill/drives.csv`. A template CSV with an example entry can be found in place. The Google Drive ID required in the CSV is the cryptic part of the Google Drive URL, usually at the end. Another example for the `drives.csv` could look like this:

| name    | drive_id                            | drive_public | description                            |
| ------- | ----------------------------------- | ------------ | -------------------------------------- |
| My Name | 2WmU2qeUouXmPefxYxMDHZnlsIYPe3KlqFy |              | "My own upside-down japanese proxies"  |
| Otto    | q6iJFoJseX-xnHKLiJlRDU2aeaM6Ditvq2X | FALSE        | "Otto's future-sight swamp collection" |

The public field is _true_ by default and can be left empty. If a drive is marked non-public, its link won't be displayed on the contribution page or in the search settings popup.

## (Optional) Step 3: Upload Google Scripts for the Client

This step is usually optional as the Google Scripts can be shared among installations. But if you find the client (`autofill.py`) not working, make sure the included Google Scripts are available at the given links. Otherwise, deploy both included scripts and update the links accordingly.

# Installation

Two alternative installation methods are described in the following. At this point in time, make sure you already have set up your `client_secrets.json` and your `drives.csv` as described previously.

## Using Docker Containers

The easiest way to get MPCAutofill running as quickly as possible is by using Docker containers. The [docker](docker/) sub-folder includes all necessary scripts to automatically set up and run MPCAutofill with all its dependencies. The only tools you need are Docker and Docker-compose.

In case you are deploying to production, also make sure to put a random secret into `docker/django/env.txt`, e.g., by running `sed -i "s/DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=$(openssl rand -base64 12)/g" docker/django/env.txt`.

### Docker on Linux

You can set up Docker and Docker-compose on a clean Ubuntu with the following instructions:

    sudo apt update
    sudo apt install -y docker.io docker-compose
    sudo usermod -aG docker $USER
    sudo reboot

Now, you can check out this repository and run the Docker scripts:

    sudo apt install -y git
    git clone https://github.com/chilli-axe/mpc-autofill.git
    cd mpc-autofill
    # At this point, configure all necessary files as described previously.
    cd docker
    docker-compose up

Depending on the size of your configured drives, this can take a while before the website becomes available at http://localhost:8000. Optionally, you can also pass "-d" to run all containers detached. In that case, you can later stop all containers with:

    docker-compose down

You can also create an admin account for http://localhost:8000/admin, if you like:

    docker-compose exec django python3 manage.py createsuperuser

### Docker on Windows

Docker can also be run on Windows through virtual machines. Download Docker Desktop and follow the installation instructions on https://docs.docker.com/desktop/windows/install/. Make sure that you have virtualization instructions enabled in your BIOS/UEFI. Most other dependencies are handled by the installer.

Once you finished the Docker Desktop installation and restarted your machine, download this repository and extract it somewhere on your machine. Make sure to configure your `client_secrets.json` and `drives.csv` as described previously. Then, open the Windows Command Prompt and navigate to the extracted repository folder. Change to the docker sub-folder and run `docker-compose up`. After a while, MPCAutofill will become available at http://localhost:8000.

![docker_cmd](https://user-images.githubusercontent.com/5053254/134817708-bb556248-e974-42e1-a92b-ce9b0325c763.png)

### Q&A: Common Problems

_Docker-compose fails with "docker.errors.DockerException: Error while fetching server API version: (2, 'CreateFile', 'The system cannot find the file specified.')"!_ Your docker daemon isn't running. Just start Docker Desktop, wait for a couple of seconds, and try again.

_The website just gives me "502 Bad Gateway"!_ The Django instance isn't ready yet, probably still scanning cards. Have a look at the docker output. Use `docker-compose logs django` if you started them detached.

_I changed some files but it looks like Docker didn't adopt those changes!_ All files (including `drives.csv`) are part of docker images and not updated automatically. If you just changed some code, `docker-compose build` should be sufficient to update the images. Affected containers will be rebuild on the next `docker-compose up`. However, if you changed, e.g., your `drives.csv`, the old state might still persist in the databases (stored in "volumes"). In this case, you can either manually trigger an update with `docker-compose exec django python3 manage.py import_sources` followed by `docker-compose exec django python3 manage.py update_database`, or, in doubt, just start all over again in a clean docker environment by executing the `docker_clean_all` script.

_The website seems to work fine but I can't generate orders!_ Do you have cardbacks in your Google Drive? Add a folder named "Cardbacks" to your Drive and put some cardbacks there!

## Manual Installation

If you aim to contribute to MPCAutofill or are familiar with running Django locally, you can also install MPCAutofill manually.

### Requirements

- Python 3.9+,
- The Python packages specified in `requirements.txt` in `$working_directory/MPCAutofill`,
- Elasticsearch 7.10.x - install natively on your machine or run in Docker,
- npm,
- A Google account.

### Step-by-Step Instructions

<b><em>All steps with the prefix [PROD] are only needed if you are deploying this web app in a production environment. For running the application locally or for development, you can skip these steps.</em></b>

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
   2. Heading Reference (`name` = Name of Drive Owner, `drive_id` = 33 character Gdrive identifier, `drive_public` = TRUE, `description` = Description of what's in that drive)
   3. Drive ID is everything after `https://drive.google.com/drive/u/0/folders/` in the Gdrive link
10. Install the main dependencies using a python virtual environment (this entire step is often automatically handled by your IDE)
    1. To initialize the environment, create the virtual environment library using `python3 -m venv $working_directory/venv`
       For Windows the command will be `py -m venv $working_directory\venv`
    2. Activate the environment using your OS specific command in the table found in this section of the docs: [Scroll to the table](https://docs.python.org/3.8/library/venv.html#creating-virtual-environments)
    3. In `$working_directory` with the virtual environment active, run the command `pip3 install -r requirements.txt` to install all requirements listed in `$working_directory/requirements.txt`
11. Install the frontend dependencies and compile it with webpack
    1. Install npm: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm.
    2. In `$working_directory/MPCAutofill`, run the command `npm install` to install the dependencies.
    3. In `$working_directory/MPCAutofill`, run the command `npm run build` to compile the frontend with webpack.
12. In `$working_directory/MPCAutofill`, run the command `python manage.py migrate` to ensure the database tables reflect any Django model changes.
13. In `$working_directory/MPCAutofill`, run the command `python manage.py update_dfcs` to synchronise the double-faced cards table with Scryfall.
14. In `$working_directory/MPCAutofill`, run the command `python manage.py import_sources` to sync sources in `$working_directory/MPCAutofill/drives.csv` to the database (optionally specifying a particular drive to sync with `-d <drivename>`)
15. (Elasticsearch must be running for this script to work)
    In `$working_directory/MPCAutofill`, run the command `python manage.py update_database` to populate the database with cards from the sources loaded with `import_sources`
16. Optionally, create a cronjob to periodically run the database updater command, to ensure MPC Autofill reflects the current state of the linked Drives, and another cronjob to periodically synchronise the double-faced cards table with Scryfall:

```
0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1
0 0 * * SUN bash /root/mpc-autofill/sync_dfcs
```

17. **[PROD]** Deploy two Google Script according to the code specified in `autofill.py` and adjust the URLs in that script to point to your GS endpoints
18. (At this point elasticsearch should be running and you should be inside the virtual environment)
    In `$working_directory/MPCAutofill`, run the command `python manage.py runserver` to start the local Django server.
19. Open your web browser and go to http://127.0.0.1:8000/
