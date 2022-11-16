#!/bin/bash

echo "Copy environment (.env) file if one does not already exist"
echo "=================================================="
DEFAULTENVFILE=MPCAutofill/MPCAutofill/.env.dist
ENVFILE=MPCAutofill/MPCAutofill/.env
if [ ! -f "$ENVFILE" ]; then
    cp $DEFAULTENVFILE $ENVFILE
    echo "$ENVFILE copied with the following contents:"
else
    echo "$ENVFILE already exists (not copied) with the following contents:"
fi
cat $ENVFILE
echo "=================================================="
