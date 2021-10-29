:: Helper script for testing purposes.
:: Completely clean up the docker environment.

:: Remove all containers
docker container prune -f
:: Remove all volumes
docker volume prune -f
:: Remove all images
FOR /f %%G in ('docker images -a -q') do docker image rm -f %%G
