FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite env vars are baked in at build time, not read at runtime -- must be
# passed as a build arg, not a container environment: variable.
ARG VITE_CITIZENS_API_URL
ENV VITE_CITIZENS_API_URL=${VITE_CITIZENS_API_URL}
RUN npm run build

FROM caddy:2.8-alpine
COPY --from=build /app/dist /srv
COPY landing /srv-landing
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
