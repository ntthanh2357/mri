# ==============================================================================
# NeuroScan AI - Expo React Native Web Frontend Dockerfile
# Stage 1: Build static web assets
# Stage 2: Serve via Nginx Alpine
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build static SPA bundle for web
ARG EXPO_PUBLIC_API_URL=""
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV NODE_ENV=production
RUN npx expo export --platform web

# Stage 2: Production Nginx Server
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Default Nginx SPA configuration
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 500 502 503 504 /50x.html; \
    location = /50x.html { \
        root /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
