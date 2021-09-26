#!/bin/bash
set -e

# Ensure that there is a newline at the end of drives.csv,
# otherwise "wc" won't count correctly.
sed -i -e '$a\' MPCAutofill/drives.csv

if [ $(cat MPCAutofill/drives.csv | wc -l) -lt 2 ]; then
    echo "=================================================="
    echo "  ERROR: No drives configured!"
    echo "  Add your Google Drives to MPCAutofill/drives.csv."
    echo "=================================================="
    exit 1
fi
