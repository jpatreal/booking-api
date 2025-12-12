FROM node:20-alpine AS base
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY drizzle.config.* ./
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DRIZZLE_CONFIG=drizzle.config.ts

RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json

COPY drizzle.config.* ./
COPY drizzle ./drizzle

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "require('net').createConnection({host:'127.0.0.1',port:process.env.PORT||4000},()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD node dist/main.js

