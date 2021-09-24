# Run MPCAutofill with docker

1. Copy your Google Service Account key to `MPCAutofill/client_secrets.json`
2. Populate `MPCAutofill/drives.csv`
3. Run `docker-compose up`
4. Browse http://localhost:8000, or equivalent

# Prepare Google Service Account

If you haven't used this before, create a Google Service Account. Create a new project, navigate to Service Accounts, create a new one, go to "Manage Keys", add new key and choose JSON format. Save this file to `MPCAutofill/client_secrets.json`

Make sure your Google Drive API is enable! Check
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=<yourprojectid>

# TODO

GS Scripts?
