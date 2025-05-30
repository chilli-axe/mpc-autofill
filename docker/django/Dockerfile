# Docker to serve Django via Unicorn
FROM ubuntu:22.04 AS builder

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install tools and additional dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        dos2unix \
        python3-pip python3-dev \
        gcc netcat curl libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt
COPY MPCAutofill/requirements.txt /MPCAutofill/
WORKDIR /MPCAutofill

# Install pip requirements
RUN pip3 install gunicorn wheel
RUN pip3 install -r requirements.txt

# Copy relevant files from repository
COPY docker /MPCAutofill/docker
COPY MPCAutofill /MPCAutofill/MPCAutofill

# Handle environment variables - write out `.env` with the variables passed from the
# compose file (and overwrite `.env` as copied from the host machine in the process)
RUN touch /MPCAutofill/MPCAutofill/MPCAutofill/.env
RUN echo "DATABASE_HOST=$DATABASE_HOST" > /MPCAutofill/MPCAutofill/MPCAutofill/.env  # using > to overwrite the file
RUN echo "ELASTICSEARCH_HOST=$ELASTICSEARCH_HOST" >> /MPCAutofill/MPCAutofill/MPCAutofill/.env
RUN echo "DEBUG=$DEBUG" >> /MPCAutofill/MPCAutofill/MPCAutofill/.env
RUN echo "ALLOWED_HOSTS=$ALLOWED_HOSTS" >> /MPCAutofill/MPCAutofill/MPCAutofill/.env
RUN echo "GAME=$GAME" >> /MPCAutofill/MPCAutofill/MPCAutofill/.env
RUN echo "MOXFIELD_SECRET=$MOXFIELD_SECRET" >> /MPCAutofill/MPCAutofill/MPCAutofill/.env

# Make sure that all scripts are executable, and in case we
# checked out under Windows with CRLF, convert line endings
RUN chmod +x docker/django/*.sh && \
    find . -type f -name "*.sh" -exec dos2unix {} \;

# Let's be nice to the user and give some clear error message
# if they missed to install any of the mandatory files.
RUN ./docker/django/check_client_secrets.sh && \
    ./docker/django/check_drives.sh

# Create a non-root user and add permission to access the /MPCAutofill folder
RUN adduser -u 5678 --disabled-password --gecos "" mpcautofill && \
    chown -R mpcautofill /MPCAutofill
USER mpcautofill

# Place environment file if one does not already exist
RUN ./docker/django/copy_env_file.sh

# Prepare folder for static files (create now as user for permissions)
RUN mkdir -p static


FROM builder AS webserver

EXPOSE 8000
WORKDIR /MPCAutofill/MPCAutofill
ENTRYPOINT ["/MPCAutofill/docker/django/entrypoint.sh"]
CMD ["gunicorn", "MPCAutofill.wsgi:application", "--bind", "0.0.0.0:8000"]

FROM builder AS worker

WORKDIR /MPCAutofill/MPCAutofill
ENTRYPOINT ["/MPCAutofill/docker/django/entrypoint.sh"]
CMD ["python3", "manage.py", "qcluster"]
