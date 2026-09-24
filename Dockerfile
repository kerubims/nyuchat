FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy project source
COPY . .

# Fetch local models (onnx/ is gitignored: ~4.5GB total).
# Embedder + reranker are direct downloads; the reranker is then converted to
# fp16 (fp32 costs ~5s/pair on CPU). Set SKIP_MODELS=1 to build without RAG.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates python3 python3-numpy \
    && rm -rf /var/lib/apt/lists/*

RUN if [ -z "$SKIP_MODELS" ]; then \
      bash scripts/fetch_bge_m3.sh onnx/embedder \
      && bash scripts/fetch_reranker.sh onnx/reranker \
      && pip3 install --no-cache-dir --break-system-packages onnx \
      && python3 scripts/to_fp16_stream.py; \
    fi

# Generate Prisma Client & Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "start"]
