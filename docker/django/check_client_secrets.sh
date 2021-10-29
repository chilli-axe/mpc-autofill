#!/bin/bash
set -e

if [ ! -f MPCAutofill/client_secrets.json ]; then
    echo "=================================================="
    echo "  ERROR: client_secrets.json missing!"
    echo "  Set up a Google Service Account and copy the"
    echo "  JSON key to MPCAutofill/client_secrets.json."
    echo "=================================================="
    exit 1
fi
