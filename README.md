# mpc-autofill

Automating MakePlayingCards's online ordering system.

The below guide describes the procedure for setting up the web component. If you're here to download the clientside program, check the [Releases](releases/) tab.

# Preparation

Before the web application can be started, a couple of user files need to be prepared and copied to the right places.

## Step 1: Setup Google Service Account

If you are running MPCAutofill for the first time, you need to set up a Google Service Account first. Go to https://console.developers.google.com/ and create a new project. Then, navigate to Service Accounts, create a new one, go to "Manage Keys", add a new key while choosing the JSON format. Finally, copy the downloaded key into the sub-folder `MPCAutofill/client_secrets.json`.

Also, make sure your Google Drive API is enabled. Otherwise, all drive imports will fail! You can verify this by visiting the following website with your Google project id inserted at the end of the link: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=yourprojectid

## Step 2: Populate Google Drive CSV

You also need some Google Drives to be added to `MPCAutofill/drives.csv`. An template CSV with an example entry can be found in place. The Google Drive ID required in the CSV is the cryptic part of the Google Drive URL, usually at the end. Another example for the `drives.csv` could look like this:

| key    | drive_id                            | drive_public | description                            |
| ------ | ----------------------------------- | ------------ | -------------------------------------- |
| MyName | 2WmU2qeUouXmPefxYxMDHZnlsIYPe3KlqFy |              | "My own upside-down japanese proxies"  |
| Otto   | q6iJFoJseX-xnHKLiJlRDU2aeaM6Ditvq2X | FALSE        | "Otto's future-sight swamp collection" |

The public field is _true_ by default and can be left empty.

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

_The website just gives me "502 Bad Gateway"!_ The Danjo instance isn't ready yet, probably still scanning cards. Have a look at the docker output. Use `docker-compose logs django` if you started them detached.

_I changed some files but it looks like Docker didn't adopt those changes!_ All files including `drives.csv` are part of the image and not updated automatically. Try `docker-compose up --build --force-recreate` to rebuild all images and containers, and to make sure that all changes are reflected in Docker.

_The website seems to work fine but I can't generate orders!_ Do you have cardbacks in your Google Drive? Add a folder named "Cardbacks" to your Drive and put some cardbacks there!

## Manual Installation

If you aim to contribute to MPCAutofill or are familiar with running Django locally, you can also install MPCAutofill manually.

To be updated with [PR #33](pull/33).

# Requirements
`requirements.txt` for the web application and local tool combined exists in the repo as well.

## Web application:
JS libraries:
* `bootstrap@4.6.0`
* `jquery-ui-touch-punch@0.2.3`
* `slick.js@1.8.1`

Other:
* [Bootstrap Superhero](https://bootswatch.com/superhero/)
* Elasticsearch (probably easiest with Docker)
* A Google account

# Setup
1. Clone this repo somewhere on your server
2. In the same directory as the repo, create a folder called `staticroot` for static assets
3. Deploy the Django project (I'm using DigitalOcean for Ubuntu) with a webserver (I'm using Apache) and serve static files with another webserver if you want (I was previously using nginx but now I just serve static files with Apache as well)
4. Run Elasticsearch
5. Set up your Google Drive credentials in the `MPCAutofill` directory (base Django directory). You should set up a Google Drive service account and store your credentials as `client_secrets.json`
6. Run the command `manage.py import_sources` to sync sources in `drives.csv` to database, and `manage.py update_database` to populate the database (optionally specifying a particular drive to sync with `-d <drivename>`)
7. Create a cronjob to periodically run the database updater command, to ensure MPC Autofill reflects the current state of the linked Drives, and another cronjob to periodically synchronise the double-faced cards table with Scryfall:
* `0 0 * * * bash /root/mpc-autofill/update_database >> /root/db_update.txt 2>&1`
* `0 0 * * SUN bash /root/mpc-autofill/sync_dfcs`
8. Deploy two Google Script according to the code specified in `autofill.py` and adjust the URLs in that script to point to your GS endpoints
