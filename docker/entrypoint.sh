#!/bin/bash
set -e

# Gather static files
python3 manage.py collectstatic --noinput

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

# Check if database is already migrated
if ! python3 manage.py migrate --check; then
    # Run migrations and populate database before first start
    echo "Running migrate..."
    python3 manage.py migrate
    echo "Running import_sources..."
    python3 manage.py import_sources
    echo "Running update_database..."
    python3 manage.py update_database
    echo "Running update_dfcs..."
    python3 manage.py update_dfcs
fi

exec "$@"
