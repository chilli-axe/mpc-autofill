#!/bin/bash

echo "Cronjob -- Retrieve double-faced cards from Sryfall..."
cd /MPCAutofill/MPCAutofill
python3 manage.py update_dfcs
