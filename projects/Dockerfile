ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.22

FROM node:22-alpine AS web-builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY vite.config.js ./
COPY src ./src
RUN npm run build

FROM ${BUILD_FROM}

RUN apk add --no-cache nginx

COPY --from=web-builder /build/dist /var/www/projects
COPY rootfs /

RUN chmod +x /etc/services.d/projects/run \
    && rm -f /etc/nginx/http.d/default.conf

LABEL \
  io.hass.version="0.1.1" \
  io.hass.type="app" \
  io.hass.arch="amd64"

EXPOSE 8099 8686
