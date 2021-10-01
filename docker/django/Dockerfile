# Docker to serve Django via Unicorn and run
# cron to regularly update the card database
FROM ubuntu:20.04

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install tools and additional dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        dos2unix \
        python3-pip python3-dev \
        gcc netcat curl cron libpq-dev \
    && rm -rf /var/lib/apt/lists/*
# Cron: Clean system tasks and allow start as unprivileged user
# This is a bit hacky but should be fine in Docker environment
RUN rm -rf /etc/cron.*/* && \
    chmod u+s /usr/sbin/cron

# Copy requirements.txt
COPY requirements.txt /MPCAutofill/
WORKDIR /MPCAutofill

# Install pip requirements
RUN pip3 install gunicorn wheel
RUN pip3 install -r requirements.txt

# Copy relevant files from repository
COPY docker /MPCAutofill/docker
COPY MPCAutofill /MPCAutofill/MPCAutofill

# Make sure that all scripts are executable, and in case we
# checked out under Windows with CRLF, convert line endings
RUN chmod +x docker/django/*.sh && \
    find . -type f -name "*.sh" -exec dos2unix {} \;

# Let's be nice to the user and give some clear error message
# if they missed to install any of the mandatory files.
RUN ./docker/django/check_client_secrets.sh && \
    ./docker/django/check_drives.sh

# Install cronjobs
RUN cp docker/django/crontab.txt /etc/crontab

# Create a non-root user and add permission to access the /MPCAutofill folder
RUN adduser -u 5678 --disabled-password --gecos "" mpcautofill && \
    chown -R mpcautofill /MPCAutofill
USER mpcautofill

# Place environment file
RUN cp docker/django/env.txt MPCAutofill/MPCAutofill/.env

# Prepare folder for static files (create now as user for permissions)
RUN mkdir -p static

# Prepare to start
EXPOSE 8000
WORKDIR /MPCAutofill/MPCAutofill
ENTRYPOINT ["/MPCAutofill/docker/django/entrypoint.sh"]
CMD ["gunicorn", "MPCAutofill.wsgi:application", "--bind", "0.0.0.0:8000"]
