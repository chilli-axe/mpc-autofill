#!/bin/bash
set -e

# Wait for postgres to come up
echo "Waiting for Postgres..."
sleep 10
while ! nc -z postgres 5432; do
    echo "Still waiting for Postgres..."
    sleep 5
done

# Wait for elasticsearch to come up
echo "Waiting for Elasticsearch..."
sleep 10
until curl --silent --output /dev/null http://elasticsearch:9200/_cat/health?h=st; do
    echo "Still waiting for Elasticsearch..."
    sleep 5
done

# Gather static files
python3 manage.py collectstatic --noinput

# Check if we are running for the first time
if ! python3 manage.py migrate --check; then
    # Run migrations and populate database
    echo "Migrate Django database..."
    python3 manage.py migrate
    echo "Read drives from CSV..."
    python3 manage.py import_sources
    echo "Scan drives and update database..."
    python3 manage.py update_database
    echo "Retrieve double-faced cards from Scryfall..."
    python3 manage.py update_dfcs
fi

exec "$@"
