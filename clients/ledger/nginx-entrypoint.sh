#!/bin/sh
# Render the nginx site with API_TOKEN and leave nginx variables ($host, $uri) alone.
set -eu
export API_TOKEN="${API_TOKEN:-}"
envsubst '${API_TOKEN}' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
