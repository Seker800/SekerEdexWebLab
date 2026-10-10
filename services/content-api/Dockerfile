FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.content-api.json ./
COPY services/content-api ./services/content-api
RUN npm ci && npm run content-api:build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/content-api ./dist/content-api
COPY services/content-api/admin.html services/content-api/admin.js services/content-api/style.css ./dist/content-api/
USER node
EXPOSE 4175
CMD ["node", "dist/content-api/serve.js"]
