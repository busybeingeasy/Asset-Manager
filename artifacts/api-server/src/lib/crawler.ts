import axios from "axios";
import { parseStringPromise } from "xml2js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";
import { getKeywordConfig } from "./keywords";

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

const NAVER_SEARCH_QUERIES: Record<string, string[]> = {
  업계뉴스: ["식품 업계","식품 기업","CJ제일제당 오뚜기 농심 풀무원 삼양","식음료 신제품","가공식품 트렌드"],
  원재료동향: ["원재료 가격","곡물 가격 동향","대두 밀 옥수수 가격","식품 원자재","설탕 유지 원가"],
  규제안전: ["식품 안전 규제","식품 리콜 회수","식품의약품안전처 식품","수입식품 검역","할당관세 식품"],
};

const STATIC_KEYWORDS = [
  "농심","오뚜기","CJ","삼양","풀무원","불닭","라면","대두",
  "밀가루","설탕","소금","유지","참기름","콩기름","버터","계란",
  "육수","국물","장류","고추장","된장","간장","유가","곡물",
  "축산","수입","수출","물가","원자재",
  "tariff","supply chain","commodity","price","export","import",
  "logistics","shipping","raw material","food","agriculture",
];

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const lowerText = text.toLowerCase();
  STATIC_KEYWORDS.forEach((kw) => {
    if (lowerText.includes(kw.toLowerCase())) keywords.add(kw);
  });
  const config = getKeywordConfig();
  const allConfigKws = [...config.high, ...config.medium].filter((e) => e.enabled);
  allConfigKws.forEach(({ value }) => {
    if (lowerText.includes(value.toLowerCase())) keywords.add(value);
  });
  return Array.from(keywords);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

async function fetchNaverSearchAPI(category: string, query: string, display = 20): Promise<NewsArticle[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.warn("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없습니다.");
    return [];
  }
  try {
    const response = await axios.get("https://openapi.naver.com/v1/search/news.json", {
      params: { query, display, start: 1, sort: "date" },
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      timeout: 10000,
    });
    const items: Array<{ title: string; description: string; link: string; pubDate: string; originallink: string }> = response.data?.items ?? [];
    return items.map((item, i) => {
      const title = stripHtml(item.title ?? "");
      const description = stripHtml(item.description ?? "");
      return {
        id: `naver-${category}-${query.slice(0,10)}-${i}-${Date.now()}`,
        category, title,
        description: description.substring(0, 200) || null,
        link: item.originallink || item.link,
        pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        keywords: extractKeywords(title + " " + description),
        source: "naver",
        timestamp: new Date().toISOString(),
      };
    }).filter((a) => !!a.title);
  } catch (err) {
    logger.error({ err, query }, "Error fetching Naver Search API");
    return [];
  }
}

async function fetchAllNaverNews(): Promise<NewsArticle[]> {
  const results: NewsArticle[] = [];
  for (const [category, queries] of Object.entries(NAVER_SEARCH_QUERIES)) {
    const perQuery = await Promise.all(queries.map((q) => fetchNaverSearchAPI(category, q, 20)));
    const seen = new Set<string>();
    for (const articles of perQuery) {
      for (const a of articles) {
        if (!seen.has(a.link)) { seen.add(a.link); results.push(a); }
      }
    }
  }
  logger.info({ total: results.length }, "All Naver news fetched");
  return results;
}

const GOOGLE_NEWS_QUERIES = [
  "food commodities supply chain tariff",
  "food raw material price inflation",
  "agricultural commodity market",
  "food ingredient shortage recall",
  "grain soybean wheat corn price",
  "food safety regulation import ban",
  "edible oil sugar price trend",
  "logistics shipping food trade",
];

async function fetchGoogleNewsRSS(query: string): Promise<NewsArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const response = await axios.get(url, { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0 (compatible; FoodNewsDashboard/1.0)" } });
    const result = await parseStringPromise(response.data);
    const items: unknown[] = result?.rss?.channel?.[0]?.item ?? [];
    const news: NewsArticle[] = [];
    for (let i = 0; i < Math.min(items.length, 20); i++) {
      const item = items[i] as Record<string, string[]>;
      const title = stripHtml(item.title?.[0] ?? "");
      const description = stripHtml(item.description?.[0] ?? "");
      const link = item.link?.[0] ?? "";
      const pubDate = item.pubDate?.[0] ?? new Date().toISOString();
      if (!title) continue;
      news.push({
        id: `google-${query.slice(0,10)}-${i}-${Date.now()}`,
        category: "해외뉴스", title,
        description: description.substring(0, 200) || null,
        link, pubDate,
        keywords: extractKeywords(title + " " + description),
        source: "google",
        timestamp: new Date().toISOString(),
      });
    }
    return news;
  } catch (err) {
    logger.error({ err, query }, "Error fetching Google News RSS");
    return [];
  }
}

async function fetchGoogleNews(): Promise<NewsArticle[]> {
  const allResults = await Promise.all(GOOGLE_NEWS_QUERIES.map((q) => fetchGoogleNewsRSS(q)));
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const articles of allResults) {
    for (const a of articles) {
      if (!seen.has(a.link)) { seen.add(a.link); merged.push(a); }
    }
  }
  logger.info({ count: merged.length }, "Fetched Google News (all queries)");
  return merged;
}

export async function crawlAllNews(): Promise<NewsArticle[]> {
  const allNews: NewsArticle[] = [];
  const [naverNews, googleNews] = await Promise.all([fetchAllNaverNews(), fetchGoogleNews()]);
  allNews.push(...naverNews, ...googleNews);
  fs.writeFileSync(NEWS_FILE, JSON.stringify(allNews, null, 2));
  logger.info({ count: allNews.length }, "Crawl complete, saved to file");
  return allNews;
}

export function readNews(): NewsArticle[] {
  try {
    if (fs.existsSync(NEWS_FILE)) return JSON.parse(fs.readFileSync(NEWS_FILE, "utf8")) as NewsArticle[];
  } catch (err) { logger.error({ err }, "Error reading news file"); }
  return [];
}

export function readTariffs(): TariffInfo {
  try {
    if (fs.existsSync(TARIFF_FILE)) return JSON.parse(fs.readFileSync(TARIFF_FILE, "utf8")) as TariffInfo;
  } catch (err) { logger.error({ err }, "Error reading tariffs file"); }
  return buildDefaultTariffs();
}

export function buildDefaultTariffs(): TariffInfo {
  const info: TariffInfo = {
    source: "농림축산식품부 공지",
    lastUpdated: new Date().toISOString(),
    items: [
      { id: "tariff-001", title: "할당관세 공시 정보 (농림축산식품부)", link: "https://www.mafra.go.kr", keywords: ["할당관세","수입","곡물","축산물"], description: "농림축산식품부에서 공시한 최신 할당관세 정보입니다.", timestamp: new Date().toISOString() },
      { id: "tariff-002", title: "관세청 품목별 세율 조회", link: "https://unipass.customs.go.kr", keywords: ["관세율","수입관세","HS코드"], description: "관세청 유니패스에서 품목별 수입 관세율을 조회할 수 있습니다.", timestamp: new Date().toISOString() },
      { id: "tariff-003", title: "식품 원재료 수입 동향 (aT 한국농수산식품유통공사)", link: "https://www.at.or.kr", keywords: ["수입동향","원재료","식품유통"], description: "aT 한국농수산식품유통공사에서 제공하는 식품 원재료 수입 동향 정보입니다.", timestamp: new Date().toISOString() },
    ],
  };
  fs.writeFileSync(TARIFF_FILE, JSON.stringify(info, null, 2));
  return info;
}
