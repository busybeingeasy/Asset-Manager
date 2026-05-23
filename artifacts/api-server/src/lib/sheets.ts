import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";
import { readNews, type NewsArticle } from "./crawler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const SHEETS_STATE_FILE = path.join(DATA_DIR, "sheets-state.json");

const HEADER_ROW = [
  "Crawled At",
  "Published Date",
  "Category",
  "Source",
  "Title",
  "Summary",
  "Keywords",
  "Risk Level",
  "URL",
];

// Keywords that raise risk level
const HIGH_RISK_KEYWORDS = ["리콜", "수입금지", "검역", "recall", "ban", "embargo", "contamination", "오염"];
const MEDIUM_RISK_KEYWORDS = ["할당관세", "tariff", "shortage", "수급", "가격상승", "수출제한"];

interface SheetsState {
  lastExportAt: string | null;
  lastExportCount: number | null;
  totalRows: number | null;
}

function loadState(): SheetsState {
  try {
    if (fs.existsSync(SHEETS_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(SHEETS_STATE_FILE, "utf8")) as SheetsState;
    }
  } catch {
    // ignore
  }
  return { lastExportAt: null, lastExportCount: null, totalRows: null };
}

function saveState(state: SheetsState): void {
  fs.writeFileSync(SHEETS_STATE_FILE, JSON.stringify(state, null, 2));
}

function isConfigured(): boolean {
  return !!(
    process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] &&
    process.env["GOOGLE_PRIVATE_KEY"] &&
    process.env["GOOGLE_SHEET_ID"]
  );
}

function getRiskLevel(article: NewsArticle): string {
  const text = (article.title + " " + (article.description ?? "") + " " + article.keywords.join(" ")).toLowerCase();
  if (HIGH_RISK_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) return "HIGH";
  if (MEDIUM_RISK_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) return "MEDIUM";
  return "LOW";
}

function articleToRow(article: NewsArticle): string[] {
  return [
    article.timestamp,
    article.pubDate,
    article.category,
    article.source === "naver" ? "🇰🇷 국내 (Naver)" : "🌍 해외 (Google)",
    article.title.replace(/<[^>]*>/g, ""),
    (article.description ?? "").replace(/<[^>]*>/g, ""),
    article.keywords.join(", "),
    getRiskLevel(article),
    article.link,
  ];
}

async function getAuthClient() {
  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"]!;
  const rawKey = process.env["GOOGLE_PRIVATE_KEY"]!;
  // Support both escaped and literal newlines
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

export async function exportToGoogleSheets(articles?: NewsArticle[]): Promise<{
  success: boolean;
  newRows: number;
  skippedDuplicates: number;
  totalRows: number;
  exportedAt: string;
  message: string;
  error: string | null;
}> {
  const exportedAt = new Date().toISOString();

  if (!isConfigured()) {
    return {
      success: false,
      newRows: 0,
      skippedDuplicates: 0,
      totalRows: 0,
      exportedAt,
      message: "Google Sheets가 연결되지 않았습니다",
      error: "GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID 환경 변수를 설정하세요",
    };
  }

  const sheetId = process.env["GOOGLE_SHEET_ID"]!;
  const articlesToExport = articles ?? readNews();

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure header row exists
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A1:I",
    });

    const existingRows = sheetData.data.values ?? [];

    // Ensure header
    if (existingRows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "A1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
      existingRows.push(HEADER_ROW);
    }

    // Build dedup set from existing URLs (column I = index 8) and titles (column E = index 4)
    const existingUrls = new Set<string>();
    const existingTitles = new Set<string>();
    for (const row of existingRows.slice(1)) {
      if (row[8]) existingUrls.add(String(row[8]).trim());
      if (row[4]) existingTitles.add(String(row[4]).trim().toLowerCase());
    }

    const newRows: string[][] = [];
    let skipped = 0;

    for (const article of articlesToExport) {
      const url = article.link.trim();
      const title = article.title.replace(/<[^>]*>/g, "").trim().toLowerCase();
      if (existingUrls.has(url) || existingTitles.has(title)) {
        skipped++;
        continue;
      }
      newRows.push(articleToRow(article));
      existingUrls.add(url);
      existingTitles.add(title);
    }

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: newRows },
      });
    }

    const totalRows = existingRows.length - 1 + newRows.length; // minus header

    const state: SheetsState = {
      lastExportAt: exportedAt,
      lastExportCount: newRows.length,
      totalRows,
    };
    saveState(state);

    logger.info({ newRows: newRows.length, skipped, totalRows }, "Google Sheets export complete");

    return {
      success: true,
      newRows: newRows.length,
      skippedDuplicates: skipped,
      totalRows,
      exportedAt,
      message: `${newRows.length}개 새 행 추가, ${skipped}개 중복 건너뜀`,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Google Sheets export failed");
    return {
      success: false,
      newRows: 0,
      skippedDuplicates: 0,
      totalRows: 0,
      exportedAt,
      message: "내보내기 실패",
      error: msg,
    };
  }
}

export function getSheetsStatus() {
  const configured = isConfigured();
  const state = loadState();
  return {
    connected: configured,
    sheetId: configured ? (process.env["GOOGLE_SHEET_ID"] ?? null) : null,
    lastExportAt: state.lastExportAt,
    lastExportCount: state.lastExportCount,
    totalRows: state.totalRows,
    error: configured ? null : "환경 변수 미설정 (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID)",
  };
}
