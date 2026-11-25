# Built from the repo root so the server can import sdk/src/validate.js (C-001).
FROM node:24-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY sdk/src /app/sdk/src
COPY sdk/package.json /app/sdk/package.json
COPY server/ ./
CMD ["node", "src/index.js"]
