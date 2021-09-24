#!/bin/bash
set -e

# Gather static files
python3 manage.py collectstatic --noinput
test -f ../static/css/bootstrap.min.css || \
    curl https://bootswatch.com/5/superhero/bootstrap.min.css \
    --output ../static/css/bootstrap.min.css
test -f ../static/js/jquery.ui.touch-punch.js || \
    curl https://raw.githubusercontent.com/furf/jquery-ui-touch-punch/master/jquery.ui.touch-punch.js \
    --output ../static/js/jquery.ui.touch-punch.js

# Wait for elasticsearch to come up
echo "Waiting for Elasticsearch..."
sleep 10
until curl --silent --output /dev/null http://elasticsearch:9200/_cat/health?h=st; do
    echo "Still waiting for Elasticsearch..."
    sleep 5
done

# Run migrations and populate database
echo "Running migrate..."
python3 manage.py migrate
echo "Running import_sources..."
python3 manage.py import_sources
echo "Running update_database..."
python3 manage.py update_database
echo "Running update_dfcs..."
python3 manage.py update_dfcs

exec "$@"
