# Built from the repo root so the server can import sdk/src/validate.js (C-001) and serve
# P1 (D-014): only the page, its stylesheet and scripts; never p1/config.js or p1/test.
FROM node:24-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY sdk/src /app/sdk/src
COPY sdk/package.json /app/sdk/package.json
COPY p1/index.html p1/styles.css /app/p1/
COPY p1/src /app/p1/src
COPY server/ ./
USER node
CMD ["node", "src/index.js"]
