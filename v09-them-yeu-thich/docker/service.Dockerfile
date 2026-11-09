# Image dùng chung cho 3 service backend. Build: docker build -f docker/service.Dockerfile --build-arg SERVICE=location .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway/package.json services/gateway/
COPY services/location/package.json services/location/
COPY services/content/package.json services/content/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY packages/shared packages/shared
COPY services services
ARG SERVICE
RUN npm run build -w packages/shared && npm run build -w services/${SERVICE}
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-alpine
ARG SERVICE
ENV NODE_ENV=production SERVICE=${SERVICE}
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/services/${SERVICE}/package.json services/${SERVICE}/
COPY --from=build /app/services/${SERVICE}/dist services/${SERVICE}/dist
USER node
WORKDIR /app/services/${SERVICE}
CMD ["node", "dist/index.js"]
