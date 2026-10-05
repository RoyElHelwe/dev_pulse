FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Scripts in /docker-entrypoint.d/ run automatically before nginx starts.
COPY --chmod=755 generate-cert.sh /docker-entrypoint.d/40-generate-cert.sh
