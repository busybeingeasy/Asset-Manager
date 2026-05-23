# 식품 뉴스 대시보드

A real-time Korean food industry news dashboard for procurement teams, crawling Naver RSS and Google News.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/food-news run dev` — run the frontend (port 26164)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + TanStack Query
- API: Express 5
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- RSS parsing: axios + xml2js
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/lib/crawler.ts` — RSS crawling logic (Naver + Google News)
- `artifacts/api-server/src/routes/news.ts` — news, stats, crawl, tariffs routes
- `artifacts/api-server/data/` — persisted news.json and tariffs.json
- `artifacts/food-news/src/` — React frontend

## Architecture decisions

- No database needed — news data is stored as JSON files in `artifacts/api-server/data/` since it's ephemeral crawled content
- News is crawled on-demand via POST /api/crawl; no automatic scheduling by default
- Tariff information is hardcoded with links to official government sources (MAFRA, Customs)
- Frontend filtering (category, keyword) is done server-side via query params

## Product

- Real-time food industry news from Naver RSS (업계뉴스, 원재료동향, 규제안전) and Google News (해외뉴스)
- Keyword search and category filtering
- News statistics summary (total, domestic, international counts)
- Manual "crawl now" button for fresh data
- Korean tariff/trade resource links panel

## Gotchas

- RSS crawling depends on Naver/Google network access — may fail in restricted environments
- The frontend at `/` and backend at `/api` are routed by the shared proxy
- After changing the OpenAPI spec, always re-run codegen before restarting workflows
