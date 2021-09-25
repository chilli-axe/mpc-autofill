#!/bin/bash

echo "Cronjob -- Scan drives and update database..."
cd /MPCAutofill/MPCAutofill
python3 manage.py update_database
