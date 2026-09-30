FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/default.conf.template
COPY nginx-entrypoint.sh /docker-entrypoint-ellensuly.sh
RUN chmod +x /docker-entrypoint-ellensuly.sh
COPY index.html styles.css /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src
ENTRYPOINT ["/docker-entrypoint-ellensuly.sh"]
