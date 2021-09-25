FROM ubuntu:20.04

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install additional dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3-pip python3-dev \
        gcc netcat curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt
COPY requirements.txt /MPCAutofill/
WORKDIR /MPCAutofill

# Install pip requirements
RUN pip3 install gunicorn wheel
RUN pip3 install -r requirements.txt

# Copy entire repository
COPY . /MPCAutofill

# Create a non-root user and add permission to access the /MPCAutofill folder
RUN adduser -u 5678 --disabled-password --gecos "" mpcautofill && \
    chown -R mpcautofill /MPCAutofill
USER mpcautofill

# Copy environment file
COPY docker/django/env.txt MPCAutofill/MPCAutofill/.env

# Prepare folder for static files (create now as user for permissions)
RUN mkdir -p static

# Prepare to start
WORKDIR /MPCAutofill/MPCAutofill
RUN chmod +x /MPCAutofill/docker/django/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/MPCAutofill/docker/django/entrypoint.sh"]
CMD ["gunicorn", "MPCAutofill.wsgi:application", "--bind", "0.0.0.0:8000"]
