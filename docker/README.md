# Run MPCAutofill with Docker

1. Copy your Google Service Account key to `MPCAutofill/client_secrets.json`
2. Populate `MPCAutofill/drives.csv`
3. Put random secret into `docker/django_env.txt` (e.g., by running `sed -i "s/DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=$(openssl rand -base64 12)/g" docker/django_env.txt`)
4. Switch to `docker` subdirectory and run `docker-compose up`
5. Browse http://localhost:8000 and start assembling your order :)

# Prepare Google Service Account

If you haven't used this before, create a Google Service Account. Create a new project, navigate to Service Accounts, create a new one, go to "Manage Keys", add new key and choose JSON format. Save this file to `MPCAutofill/client_secrets.json`

Make sure your Google Drive API is enabled! Check
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=yourprojectid

# Docker Installation on Ubuntu

You can setup MPCAutofill using docker on a clean Ubuntu with the following instructions:

    sudo apt update
    sudo apt install docker.io docker-compose
    sudo usermod -aG docker $USER
    sudo reboot

    sudo apt install git
    git clone https://github.com/fklemme/mpc-autofill.git
    cd mpc-autofill
    # Edit files according to the top of this README
    cd docker
    docker-compose up -d

Depending on the size of your configured drives, this can take a while before the website becomes available.
Later, you can stop all containers with:

    docker-compose down

You can also create an admin account for http://localhost:8000/admin, if you like:

    docker-compose exec django python3 manage.py createsuperuser

# TODOs

- Setup cronjobs for long-running containers
- Handle Google Scripts for the client tool?
