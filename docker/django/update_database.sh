#!/bin/bash

# Called by cron to scan drives and update the database

cd /MPCAutofill/MPCAutofill
python3 manage.py update_database
