FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --only=production

COPY . .

RUN mkdir -p logs wallet

EXPOSE 4000

CMD ["node", "server.js"]
