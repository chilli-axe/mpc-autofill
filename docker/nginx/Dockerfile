# Docker to serve the static Next.js frontend via nginx
FROM nginx:1.21-alpine

# Copy nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/conf.d

# Copy common and frontend files
COPY frontend /frontend
RUN rm -rf /frontend/out
COPY common /common
WORKDIR /frontend

# install npm
RUN apk add --update npm

# Build frontend, placing files in /frontend/out
RUN npm install
RUN npm install -g npx
RUN npx next build

# Copy our static site files into the directory that the nginx docker container consumes files from
RUN cp -r out/* /usr/share/nginx/html
