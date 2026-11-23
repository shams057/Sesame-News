# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json .sequelizerc ./
COPY src ./src
COPY migrations ./migrations
COPY seeders ./seeders
COPY scripts ./scripts
COPY docs ./docs
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node node_modules/sequelize-cli/lib/sequelize db:migrate && node node_modules/sequelize-cli/lib/sequelize db:seed:all && node src/server.js"]
