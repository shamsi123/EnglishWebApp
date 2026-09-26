FROM node:22-alpine AS build
WORKDIR /repo
COPY content/ content/
COPY apps/web/package*.json apps/web/
RUN cd apps/web && npm ci
COPY apps/web/ apps/web/
RUN cd apps/web && npm run build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# SPA fallback so deep links like /journey/ar work
RUN printf 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
