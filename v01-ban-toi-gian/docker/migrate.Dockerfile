# Chạy migration + dữ liệu mẫu: docker compose run --rm migrate
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-save --ignore-scripts mssql@11
COPY scripts scripts
COPY db db
RUN node scripts/generate-seed.mjs
USER node
CMD ["node", "scripts/db-migrate.mjs", "--seed"]
