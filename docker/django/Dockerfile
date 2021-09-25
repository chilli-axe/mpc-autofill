FROM ubuntu:20.04

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install tools and additional dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3-pip python3-dev \
        gcc netcat curl cron \
    && rm -rf /var/lib/apt/lists/*
# Cron: Clean system tasks and allow start as unprivileged user
RUN rm -rf /etc/cron.*/* && \
    chmod u+s /usr/sbin/cron

# Copy requirements.txt
COPY requirements.txt /MPCAutofill/
WORKDIR /MPCAutofill

# Install pip requirements
RUN pip3 install gunicorn wheel
RUN pip3 install -r requirements.txt

# Copy entire repository
COPY . /MPCAutofill

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

# Make sure that all scripts are executable (for cron and entrypoint)
RUN chmod +x docker/django/*.sh

# Prepare to start
EXPOSE 8000
WORKDIR /MPCAutofill/MPCAutofill
ENTRYPOINT ["/MPCAutofill/docker/django/entrypoint.sh"]
CMD ["gunicorn", "MPCAutofill.wsgi:application", "--bind", "0.0.0.0:8000"]
