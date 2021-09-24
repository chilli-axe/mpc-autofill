# Sources: https://testdriven.io/blog/dockerizing-django-with-postgres-gunicorn-and-nginx/

FROM ubuntu:20.04
#SHELL ["/bin/bash", "-c"]

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install additional dependencies
RUN set -eux; \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3-pip \
        python3-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy repository
COPY .. /app
WORKDIR /app

# Install pip requirements
RUN pip3 install --upgrade pip
RUN pip3 install gunicorn wheel
RUN pip3 install -r requirements.txt

# Creates a non-root user with an explicit UID and adds permission to access the /app folder
RUN adduser -u 5678 --disabled-password --gecos "" appuser && \
    chown -R appuser /app
USER appuser

# MPCAutofill settings
RUN echo "DJANGO_SECRET_KEY=$(openssl rand -base64 12)" >> MPCAutofill/MPCAutofill/.env
RUN echo "DJANGO_DEBUG=True" >> MPCAutofill/MPCAutofill/.env

# Run migrations
WORKDIR /app/MPCAutofill
RUN python3 manage.py migrate

RUN python3 manage.py collectstatic

EXPOSE 8000

# During debugging, this entry point will be overridden. For more information, please refer to https://aka.ms/vscode-docker-python-debug
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "MPCAutofill.wsgi"]
