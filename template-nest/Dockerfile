FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

FROM base AS dev
RUN npm install && npx prisma generate
COPY tsconfig*.json nest-cli.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && npx nest start --watch"]

FROM base AS build
RUN npm ci && npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
