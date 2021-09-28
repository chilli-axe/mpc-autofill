# Docker to serve Django's static files via Nginx
FROM nginx:1.21-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/conf.d
