# Docker to serve the static Next.js frontend via nginx
FROM nginx:1.21-alpine

# Copy common and frontend files
COPY frontend /frontend
RUN rm -rf /frontend/out
COPY common /common
WORKDIR /frontend

# Point frontend at the correct URL to communicate with the backend
RUN if ! grep -q "^NEXT_PUBLIC_BACKEND_URL=" /frontend/.env /frontend/.env.local 2>/dev/null; then \
    echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:80" > /frontend/.env.local; \
fi

# install npm
RUN apk add --update npm

# Build frontend, placing files in /frontend/out
RUN npm install
RUN npm install -g npx
RUN npx next build

# Copy our static site files into the directory that the nginx docker container consumes files from
RUN cp -r out/* /usr/share/nginx/html

# Copy nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/conf.d
