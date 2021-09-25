#!/bin/bash

# Called by cron to update double-faced cards

cd /MPCAutofill/MPCAutofill
python3 manage.py update_dfcs
