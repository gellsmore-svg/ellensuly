FROM node:18-alpine AS build
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/default.conf.template
COPY nginx-entrypoint.sh /docker-entrypoint-ellensuly.sh
RUN chmod +x /docker-entrypoint-ellensuly.sh
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint-ellensuly.sh"]
