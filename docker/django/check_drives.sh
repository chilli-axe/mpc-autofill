#!/bin/bash
set -e

if [ $(cat MPCAutofill/drives.csv | wc -l) -lt 2 ]; then
    echo "=================================================="
    echo "  ERROR: No drives configured!"
    echo "  Add your Google Drives to MPCAutofill/drives.csv."
    echo "=================================================="
    exit 1
fi
