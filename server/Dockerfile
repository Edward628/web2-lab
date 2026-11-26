# Built from the repo root so the server can import sdk/src/validate.js (C-001) and serve
# P1 and the dashboard (D-014): only the pages, stylesheets and scripts; never
# p1/config.js, p1/test or dashboard/test.
FROM node:24-alpine
# production: Express's default error handler sends no stack trace (security review, PR #20).
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY sdk/src /app/sdk/src
COPY sdk/package.json /app/sdk/package.json
COPY p1/index.html p1/styles.css /app/p1/
COPY p1/src /app/p1/src
COPY dashboard/index.html dashboard/login.html dashboard/styles.css /app/dashboard/
COPY dashboard/src /app/dashboard/src
COPY server/ ./
USER node
CMD ["node", "src/index.js"]
