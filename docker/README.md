# Run MPCAutofill with docker

1. Copy your Google Service Account key to `MPCAutofill/client_secrets.json`
2. Populate `MPCAutofill/drives.csv`
3. Run `docker-compose up`
4. Browse http://localhost:8000, or equivalent

# Prepare Google Service Account

If you haven't used this before, create a Google Service Account. Create a new project, navigate to Service Accounts, create a new one, go to "Manage Keys", add new key and choose JSON format. Save this file to `MPCAutofill/client_secrets.json`

Make sure your Google Drive API is enable! Check
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=<yourprojectid>

# Installation on Ubuntu

You can setup MPCAutofill using docker on a clean Ubuntu with the following instructions:

    sudo apt update
    sudo apt install docker.io docker-compose
    sudo usermod -aG docker $USER
    reboot

    sudo apt install git
    git clone https://github.com/fklemme/mpc-autofill.git
    cd mpc-autofill/docker
    docker-compose up -d

Depending on the size of your configured drives, this can take a while before the website becomes available.
Later, stop all containers with:

    docker-compose down

# TODO

Cronjobs?
GS Scripts?
