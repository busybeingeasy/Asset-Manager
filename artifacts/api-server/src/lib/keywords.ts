import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const KEYWORDS_FILE = path.join(DATA_DIR, "keywords.json");

export interface KeywordEntry {
  id: string;
  value: string;
  enabled: boolean;
}

export interface KeywordConfig {
  high: KeywordEntry[];
  medium: KeywordEntry[];
}

const DEFAULT_CONFIG: KeywordConfig = {
  high: [
    { id: "h1", value: "리콜", enabled: true },
    { id: "h2", value: "수입금지", enabled: true },
    { id: "h3", value: "할당관세", enabled: true },
    { id: "h4", value: "관세", enabled: true },
    { id: "h5", value: "공급중단", enabled: true },
    { id: "h6", value: "shortage", enabled: true },
    { id: "h7", value: "recall", enabled: true },
    { id: "h8", value: "tariff", enabled: true },
    { id: "h9", value: "ban", enabled: true },
    { id: "h10", value: "embargo", enabled: true },
    { id: "h11", value: "검역", enabled: true },
    { id: "h12", value: "수출제한", enabled: true },
  ],
  medium: [
    { id: "m1", value: "작황", enabled: true },
    { id: "m2", value: "가격인상", enabled: true },
    { id: "m3", value: "가뭄", enabled: true },
    { id: "m4", value: "폭우", enabled: true },
    { id: "m5", value: "물류지연", enabled: true },
    { id: "m6", value: "원가상승", enabled: true },
    { id: "m7", value: "crop", enabled: true },
    { id: "m8", value: "drought", enabled: true },
    { id: "m9", value: "delay", enabled: true },
    { id: "m10", value: "price increase", enabled: true },
    { id: "m11", value: "inflation", enabled: true },
    { id: "m12", value: "공급망", enabled: true },
  ],
};

export function getKeywordConfig(): KeywordConfig {
  try {
    if (fs.existsSync(KEYWORDS_FILE)) {
      const data = JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf8")) as KeywordConfig;
      // Validate shape
      if (Array.isArray(data.high) && Array.isArray(data.medium)) {
        return data;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read keywords config, using defaults");
  }
  return DEFAULT_CONFIG;
}

export function saveKeywordConfig(config: KeywordConfig): KeywordConfig {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(config, null, 2));
  logger.info({ high: config.high.length, medium: config.medium.length }, "Keyword config saved");
  return config;
}

export function getEnabledKeywords(level: "high" | "medium"): string[] {
  const config = getKeywordConfig();
  return config[level].filter((e) => e.enabled).map((e) => e.value);
}

export function getAllEnabledKeywords(): { high: string[]; medium: string[] } {
  return {
    high: getEnabledKeywords("high"),
    medium: getEnabledKeywords("medium"),
  };
}

export function getRiskLevel(text: string): "HIGH" | "MEDIUM" | "LOW" {
  const lower = text.toLowerCase();
  const { high, medium } = getAllEnabledKeywords();
  if (high.some((kw) => lower.includes(kw.toLowerCase()))) return "HIGH";
  if (medium.some((kw) => lower.includes(kw.toLowerCase()))) return "MEDIUM";
  return "LOW";
}

const FOOD_FILTER_FILE = path.join(DATA_DIR, "food-filter.json");

const DEFAULT_FOOD_FILTER = [
  "식품","음식","식재료","원재료","농산물","축산","수산","곡물","밀","대두","옥수수",
  "설탕","유지","버터","계란","육류","가공식품","식음료","라면","과자","음료","유통",
  "식약처","농식품","농협","수입식품","수출식품","관세","할당관세","검역","작황",
  "food","grain","soybean","wheat","corn","sugar","oil","commodity","agriculture",
  "tariff","supply chain","recall","shortage","ingredient","edible","livestock",
  "CJ","오뚜기","농심","풀무원","삼양","대상","롯데","SPC","빙그레","동원",
];

export function getFoodFilterKeywords(): string[] {
  try {
    if (fs.existsSync(FOOD_FILTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(FOOD_FILTER_FILE, "utf8")) as string[];
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to read food filter, using defaults");
  }
  return DEFAULT_FOOD_FILTER;
}

export function saveFoodFilterKeywords(keywords: string[]): string[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FOOD_FILTER_FILE, JSON.stringify(keywords, null, 2));
  return keywords;
}

export function isFoodRelated(title: string, description: string): boolean {
  const text = (title + " " + description).toLowerCase();
  return getFoodFilterKeywords().some((kw) => text.includes(kw.toLowerCase()));
}
