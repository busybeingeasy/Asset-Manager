import { Router, type IRouter } from "express";
import {
  GetNewsQueryParams,
  GetNewsResponse,
  GetNewsStatsResponse,
  TriggerCrawlResponse,
  GetTariffsResponse,
} from "@workspace/api-zod";
import {
  crawlAllNews,
  readNews,
  readTariffs,
  buildDefaultTariffs,
} from "../lib/crawler";

const router: IRouter = Router();

router.get("/news", async (req, res): Promise<void> => {
  const query = GetNewsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let news = readNews();

  if (query.data.category) {
    news = news.filter((n) => n.category === query.data.category);
  }

  if (query.data.keyword) {
    const kw = query.data.keyword.toLowerCase();
    news = news.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) ||
        n.description?.toLowerCase().includes(kw) ||
        n.keywords.some((k) => k.toLowerCase().includes(kw))
    );
  }

  news.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  res.json(GetNewsResponse.parse(news));
});

router.get("/news/stats", async (_req, res): Promise<void> => {
  const news = readNews();

  const byCategory: Record<string, number> = {};
  let naverCount = 0;
  let googleCount = 0;
  let lastCrawled: string | null = null;

  for (const article of news) {
    byCategory[article.category] = (byCategory[article.category] ?? 0) + 1;
    if (article.source === "naver") naverCount++;
    if (article.source === "google") googleCount++;
    if (!lastCrawled || article.timestamp > lastCrawled) {
      lastCrawled = article.timestamp;
    }
  }

  res.json(
    GetNewsStatsResponse.parse({
      total: news.length,
      byCategory,
      lastCrawled,
      sources: { naver: naverCount, google: googleCount },
    })
  );
});

router.post("/crawl", async (req, res): Promise<void> => {
  try {
    req.log.info("Starting news crawl");
    const news = await crawlAllNews();
    res.json(
      TriggerCrawlResponse.parse({
        status: "success",
        count: news.length,
        message: `${news.length}개의 뉴스가 업데이트되었습니다`,
      })
    );
  } catch (err) {
    req.log.error({ err }, "Crawl failed");
    res.status(500).json(
      TriggerCrawlResponse.parse({
        status: "error",
        count: 0,
        message: "크롤링 중 오류가 발생했습니다",
      })
    );
  }
});

router.get("/tariffs", async (_req, res): Promise<void> => {
  let tariffs = readTariffs();
  if (!tariffs.items?.length) {
    tariffs = buildDefaultTariffs();
  }
  res.json(GetTariffsResponse.parse(tariffs));
});

export default router;
