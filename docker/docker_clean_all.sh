#!/bin/bash

# Helper script for testing purposes.
# Completely clean up the docker environment.

# Remove all containers
docker rm -f $(docker ps -a -q)
# Remove all volumes
docker volume rm $(docker volume ls -q)
# Remove all images
docker rmi -f $(docker images -a -q)
