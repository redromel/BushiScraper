# ---------- deps (keep dev deps so playwright is present) ----------
FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- runtime ----------
FROM node:20-bullseye AS runner
ENV NODE_ENV=production
WORKDIR /app

# package.json needed if you use `npm start`
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copy your app code
COPY server ./server
# COPY services ./services   # uncomment if you import from ../services

# --- Playwright setup ---
# 1) Install OS deps as root
RUN npx --yes playwright install-deps chromium

# 2) Choose a shared browsers path and give it to the node user
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN mkdir -p /ms-playwright && chown -R node:node /ms-playwright

# 3) Install the Chromium browser binaries AS node user into that path
USER node
RUN npx --yes playwright install chromium

# --- App runtime ---
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/api/server.js"] 
