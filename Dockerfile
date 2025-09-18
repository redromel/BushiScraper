# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- runtime ----------
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# needed if you use `npm start`
COPY package*.json ./

# bring prod node_modules
COPY --from=deps /app/node_modules ./node_modules

# copy your app
COPY server ./server
# COPY services ./services  # <- uncomment only if your API imports from ../services

# security: run as non-root
USER node

# network
ENV PORT=3000
EXPOSE 3000

# package.json should have: "start": "node server/api/server.js"
CMD ["npm", "start"]
# (or skip npm scripts:)
# CMD ["node", "server/api/server.js"]
