#!/bin/bash

echo "$(date) -- CRON TEST!"

cd /MPCAutofill/MPCAutofill
python3 manage.py migrate --check
