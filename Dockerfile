FROM node:24-alpine AS helper
WORKDIR /opt/wallet-helper
COPY wallet-helper/package.json wallet-helper/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY wallet-helper/wallet-helper.mjs ./

FROM nginx:1.31.7-alpine
RUN apk add --no-cache nodejs
COPY --from=helper /opt/wallet-helper /opt/wallet-helper
COPY nginx-templates/ /etc/nginx/templates/
RUN rm -rf /usr/share/nginx/html/*
COPY bitcoin-family-dashboard/index.html bitcoin-family-dashboard/btc.png bitcoin-family-dashboard/favicon.png /usr/share/nginx/html/
COPY bitcoin-family-dashboard/assets/ /usr/share/nginx/html/assets/
COPY bitcoin-family-dashboard/images/ /usr/share/nginx/html/images/
EXPOSE 80
