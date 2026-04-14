FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY index.html ./
COPY vite.config.* ./
COPY tsconfig*.json ./
COPY postcss.config.js tailwind.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build:client

FROM node:20-alpine AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY server/package.json server/package-lock.json* ./server/
RUN --mount=type=cache,target=/root/.npm sh -c "cd server && npm ci --omit=dev"
COPY server ./server

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/index.js"]

