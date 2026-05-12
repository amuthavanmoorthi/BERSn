FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache python3

COPY package*.json ./
RUN npm ci --omit=dev

COPY data ./data
COPY database ./database
COPY python ./python
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["sh", "-c", "node dist/scripts/runDbMigrations.js && node dist/scripts/bootstrapAdmin.js && node dist/scripts/seedRbacAccounts.js && node dist/server.js"]
