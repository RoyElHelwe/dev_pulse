FROM nginx:1.27-alpine

# Nginx config
COPY ./conf.d/dev_pulse.conf /etc/nginx/conf.d/default.conf

# For ACME challenge (optional)
RUN mkdir -p /var/www/certbot
