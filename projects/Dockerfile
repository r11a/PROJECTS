ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.22

FROM node:22-alpine AS web-builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY vite.config.js ./
COPY icon.png ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS server-dependencies
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM ${BUILD_FROM}

RUN apk add --no-cache ca-certificates nginx nodejs poppler-utils postgresql17 postgresql17-client su-exec

COPY --from=web-builder /build/dist /var/www/projects
COPY --from=server-dependencies /build/node_modules /opt/projects/node_modules
COPY server /opt/projects/server
COPY migrations /opt/projects/migrations
COPY src/data.js /opt/projects/src/data.js
COPY package.json /opt/projects/package.json
COPY rootfs /

RUN chmod +x /etc/services.d/nginx/run /etc/services.d/postgresql/run /etc/services.d/api/run \
    && rm -f /etc/nginx/http.d/default.conf

LABEL \
  io.hass.version="0.17.0" \
  io.hass.type="app" \
  io.hass.arch="amd64"

EXPOSE 8099 8686
