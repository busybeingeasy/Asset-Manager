import axios from "axios";
import { parseStringPromise } from "xml2js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const NEWS_FILE = path.join(DATA_DIR, "news.json");
const TARIFF_FILE = path.join(DATA_DIR, "tariffs.json");

export interface NewsArticle {
  id: string;
  category: string;
  title: string;
  description: string | null;
  link: string;
  pubDate: string;
  keywords: string[];
  source: string;
  timestamp: string;
}

export interface TariffItem {
  id: string;
  title: string;
  link: string;
  keywords: string[];
  description: string;
  timestamp: string;
}

export interface TariffInfo {
  source: string;
  lastUpdated: string;
  items: TariffItem[];
}

const NAVER_RSS_URLS: Record<string, string> = {
  업계뉴스: "https://news.naver.com/rss/section/105.xml",
  원재료동향: "https://news.naver.com/rss/section/106.xml",
  규제안전: "https://news.naver.com/rss/section/103.xml",
};

const KEYWORDS_KOR = [
  "농심", "오뚜기", "CJ", "삼양", "풀무원", "불닭", "라면", "대두",
  "밀가루", "설탕", "소금", "유지", "참기름", "콩기름", "버터", "계란",
  "육수", "국물", "장류", "고추장", "된장", "간장", "유가", "곡물",
  "축산", "할당관세", "수입", "수출", "물가", "원자재",
];

const KEYWORDS_ENG = [
  "tariff", "supply chain", "commodity", "price", "export", "import",
  "logistics", "shipping", "inflation", "raw material", "food", "agriculture",
];

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const lowerText = text.toLowerCase();

  KEYWORDS_KOR.forEach((kw) => {
    if (lowerText.includes(kw)) keywords.add(kw);
  });

  KEYWORDS_ENG.forEach((kw) => {
    if (lowerText.includes(kw.toLowerCase())) keywords.add(kw);
  });

  return Array.from(keywords);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

async function fetchNaverRSS(category: string): Promise<NewsArticle[]> {
  const url = NAVER_RSS_URLS[category];
  if (!url) return [];

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoodNewsDashboard/1.0)" },
    });
    const result = await parseStringPromise(response.data);
    const items: unknown[] = result?.rss?.channel?.[0]?.item ?? [];
    const news: NewsArticle[] = [];

    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i] as Record<string, string[]>;
      const title = stripHtml(item.title?.[0] ?? "");
      const description = stripHtml(item.description?.[0] ?? "");
      const link = item.link?.[0] ?? "";
      const pubDate = item.pubDate?.[0] ?? new Date().toISOString();

      if (!title) continue;

      news.push({
        id: `${category}-${i}-${Date.now()}`,
        category,
        title,
        description: description.substring(0, 200) || null,
        link,
        pubDate,
        keywords: extractKeywords(title + " " + description),
        source: "naver",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({ category, count: news.length }, "Fetched Naver RSS");
    return news;
  } catch (err) {
    logger.error({ err, category }, "Error fetching Naver RSS");
    return [];
  }
}

async function fetchGoogleNews(): Promise<NewsArticle[]> {
  const query = "food commodities supply chain tariff";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoodNewsDashboard/1.0)" },
    });
    const result = await parseStringPromise(response.data);
    const items: unknown[] = result?.rss?.channel?.[0]?.item ?? [];
    const news: NewsArticle[] = [];

    for (let i = 0; i < Math.min(items.length, 5); i++) {
      const item = items[i] as Record<string, string[]>;
      const title = stripHtml(item.title?.[0] ?? "");
      const description = stripHtml(item.description?.[0] ?? "");
      const link = item.link?.[0] ?? "";
      const pubDate = item.pubDate?.[0] ?? new Date().toISOString();

      if (!title) continue;

      news.push({
        id: `google-${i}-${Date.now()}`,
        category: "해외뉴스",
        title,
        description: description.substring(0, 200) || null,
        link,
        pubDate,
        keywords: extractKeywords(title + " " + description),
        source: "google",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({ count: news.length }, "Fetched Google News");
    return news;
  } catch (err) {
    logger.error({ err }, "Error fetching Google News");
    return [];
  }
}

export async function crawlAllNews(): Promise<NewsArticle[]> {
  const allNews: NewsArticle[] = [];

  const [naverResults, googleNews] = await Promise.all([
    Promise.all(Object.keys(NAVER_RSS_URLS).map((cat) => fetchNaverRSS(cat))),
    fetchGoogleNews(),
  ]);

  naverResults.forEach((r) => allNews.push(...r));
  allNews.push(...googleNews);

  fs.writeFileSync(NEWS_FILE, JSON.stringify(allNews, null, 2));
  logger.info({ count: allNews.length }, "Crawl complete, saved to file");

  return allNews;
}

export function readNews(): NewsArticle[] {
  try {
    if (fs.existsSync(NEWS_FILE)) {
      return JSON.parse(fs.readFileSync(NEWS_FILE, "utf8")) as NewsArticle[];
    }
  } catch (err) {
    logger.error({ err }, "Error reading news file");
  }
  return [];
}

export function readTariffs(): TariffInfo {
  try {
    if (fs.existsSync(TARIFF_FILE)) {
      return JSON.parse(fs.readFileSync(TARIFF_FILE, "utf8")) as TariffInfo;
    }
  } catch (err) {
    logger.error({ err }, "Error reading tariffs file");
  }
  return buildDefaultTariffs();
}

export function buildDefaultTariffs(): TariffInfo {
  const info: TariffInfo = {
    source: "농림축산식품부 공지",
    lastUpdated: new Date().toISOString(),
    items: [
      {
        id: "tariff-001",
        title: "할당관세 공시 정보 (농림축산식품부)",
        link: "https://www.mafra.go.kr",
        keywords: ["할당관세", "수입", "곡물", "축산물"],
        description:
          "농림축산식품부에서 공시한 최신 할당관세 정보입니다. 정기적으로 확인하세요.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "tariff-002",
        title: "관세청 품목별 세율 조회",
        link: "https://unipass.customs.go.kr",
        keywords: ["관세율", "수입관세", "HS코드"],
        description:
          "관세청 유니패스에서 품목별 수입 관세율을 조회할 수 있습니다.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "tariff-003",
        title: "식품 원재료 수입 동향 (aT 한국농수산식품유통공사)",
        link: "https://www.at.or.kr",
        keywords: ["수입동향", "원재료", "식품유통"],
        description:
          "aT 한국농수산식품유통공사에서 제공하는 식품 원재료 수입 동향 정보입니다.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
  fs.writeFileSync(TARIFF_FILE, JSON.stringify(info, null, 2));
  return info;
}
