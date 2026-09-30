# ==============================================================================
# NeuroScan AI - Core Backend Dockerfile (Node.js 20 Alpine)
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create dedicated directories with non-root permissions
RUN mkdir -p uploads/imaging-results uploads/dicom-archives scratch && chown -R node:node /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

USER node

EXPOSE 5000

CMD ["node", "src/index.js"]
