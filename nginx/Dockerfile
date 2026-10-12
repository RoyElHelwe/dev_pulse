# Reverse proxy Dockerfile for Dev Pulse.
# Builds the nginx image used in production and development to terminate TLS and route client traffic.
# Wires client requests to the api (NestJS:4000) and web (Next.js:3000) container services.
FROM nginx:1.27-alpine
# OpenSSL is required by generate-cert.sh to create self-signed certificates on startup.
RUN apk add --no-cache openssl
# Installs the reverse proxy server block and WebSocket routing rules.
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Scripts in /docker-entrypoint.d/ run automatically before nginx starts.
COPY --chmod=755 generate-cert.sh /docker-entrypoint.d/40-generate-cert.sh
