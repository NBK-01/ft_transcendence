#!/bin/sh
# Runs automatically (anything executable under /docker-entrypoint.d/ is run
# by the official nginx:alpine image's entrypoint before nginx starts).
# Self-signed, local-only — never commit a cert/key to git. mkcert would avoid
# the one-time browser trust warning, but isn't required: the subject only
# requires HTTPS, not a CA-trusted certificate.
set -e

CERT_DIR=/etc/nginx/certs

if [ ! -f "$CERT_DIR/server.crt" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/CN=localhost"
fi
