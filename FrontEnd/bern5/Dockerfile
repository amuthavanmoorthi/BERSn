FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

ENV PORT=8080

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/40-write-env.sh /docker-entrypoint.d/40-write-env.sh

RUN chmod +x /docker-entrypoint.d/40-write-env.sh

EXPOSE 8080
