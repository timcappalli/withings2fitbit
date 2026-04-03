FROM node:24.14-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=app:app app.js tokenHandling.js util.js ./

USER app

ENV NODE_ENV=production

CMD ["node", "app.js"]

LABEL org.opencontainers.image.source="https://github.com/timcappalli/withings2fitbit"
