# Docker to serve the static Next.js frontend via nginx
FROM node:18-alpine AS builder

# Copy frontend files
COPY frontend /frontend
RUN rm -rf /frontend/out
WORKDIR /frontend

# Point frontend at the correct URL to communicate with the backend
RUN if ! grep -q "^NEXT_PUBLIC_BACKEND_URL=" /frontend/.env /frontend/.env.local 2>/dev/null; then \
    echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:80" > /frontend/.env.local; \
fi

# Build frontend, placing files in /frontend/out
RUN npm install
RUN npx next build

FROM nginx:1.21-alpine

# Copy our static site files into the directory that the nginx docker container consumes files from
COPY --from=builder /frontend/out /usr/share/nginx/html

# Copy nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/conf.d
