import axios from "axios";
import { logger } from "./logger";

// ── EIA 유가 (WTI, 브렌트유) ──────────────────────────
export async function fetchOilPrices() {
  const key = process.env.EIA_API_KEY;
  if (!key) { logger.warn("EIA_API_KEY 없음"); return []; }
  try {
    const [wti, brent] = await Promise.all([
      axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=2`),
      axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=2`),
    ]);
    const wtiRows = wti.data?.response?.data ?? [];
    const brentRows = brent.data?.response?.data ?? [];
    const results: any[] = [];
    if (wtiRows.length >= 1) {
      const cur = parseFloat(wtiRows[0]?.value);
      const prev = wtiRows[1] ? parseFloat(wtiRows[1]?.value) : null;
      results.push({ name: "WTI유 (Crude Oil)", symbol: "WTI", value: cur, prevValue: prev, change: prev != null ? cur - prev : null, changePct: prev != null ? ((cur - prev) / prev) * 100 : null, unit: "USD/배럴", date: wtiRows[0]?.period, source: "EIA" });
    }
    if (brentRows.length >= 1) {
      const cur = parseFloat(brentRows[0]?.value);
      const prev = brentRows[1] ? parseFloat(brentRows[1]?.value) : null;
      results.push({ name: "브렌트유 (Brent Crude)", symbol: "BRENT", value: cur, prevValue: prev, change: prev != null ? cur - prev : null, changePct: prev != null ? ((cur - prev) / prev) * 100 : null, unit: "USD/배럴", date: brentRows[0]?.period, source: "EIA" });
    }
    return results;
  } catch (err) { logger.error({ err }, "EIA fetch error"); return []; }
}

// ── Alpha Vantage 원물 선물 ───────────────────────────
const AV_COMMODITIES = [
  { symbol: "WHEAT", name: "밀 (Wheat)", unit: "USD/부셸" },
  { symbol: "CORN", name: "옥수수 (Corn)", unit: "USD/부셸" },
  { symbol: "SUGAR", name: "설탕 (Sugar)", unit: "USD/파운드" },
  { symbol: "COFFEE", name: "커피 (Coffee)", unit: "USD/파운드" },
  { symbol: "COTTON", name: "면화 (Cotton)", unit: "USD/파운드" },
  { symbol: "NATURAL_GAS", name: "천연가스", unit: "USD/MMBtu" },
];

export async function fetchCommodityPrices() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) { logger.warn("ALPHA_VANTAGE_API_KEY 없음"); return []; }
  const results: any[] = [];
  for (const c of AV_COMMODITIES) {
    try {
      const res = await axios.get(`https://www.alphavantage.co/query?function=${c.symbol}&interval=monthly&apikey=${key}`);
      const rows = res.data?.data ?? [];
      if (rows.length >= 2) {
        const cur = parseFloat(rows[0].value);
        const prev = parseFloat(rows[1].value);
        results.push({ name: c.name, symbol: c.symbol, value: cur, prevValue: prev, change: cur - prev, changePct: ((cur - prev) / prev) * 100, unit: c.unit, date: rows[0].date, source: "Alpha Vantage" });
      } else if (rows.length === 1) {
        results.push({ name: c.name, symbol: c.symbol, value: parseFloat(rows[0].value), prevValue: null, change: null, changePct: null, unit: c.unit, date: rows[0].date, source: "Alpha Vantage" });
      }
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) { logger.error({ err, symbol: c.symbol }, "AV fetch error"); }
  }
  return results;
}

// ── 한국은행 ECOS KeyStatisticList (환율 + 거시지표) ───────────
// 주의: http (https 아님), KeyStatisticList 엔드포인트 사용 (StatisticSearch는 실패함)
const ECOS_BASE = "http://ecos.bok.or.kr/api";

export async function fetchECOSKeyStats() {
  const key = process.env.ECOS_API_KEY;
  if (!key) { logger.warn("ECOS_API_KEY 없음"); return { fx: [], macro: [] }; }
  try {
    const res = await axios.get(`${ECOS_BASE}/KeyStatisticList/${key}/json/kr/1/100/`, { timeout: 15000 });
    const rows = res.data?.KeyStatisticList?.row ?? [];

    if (rows.length === 0) {
      logger.warn({ raw: JSON.stringify(res.data).slice(0, 300) }, "ECOS KeyStatisticList returned no rows");
    }

    const fxKeywords = ["원/달러", "원/위안", "원/엔", "원/유로", "원/100엔"];
    const macroKeywords = ["기준금리", "소비자물가", "생산자물가"];

    const fx = rows
      .filter((r: any) => fxKeywords.some(k => r.KEYSTAT_NAME?.includes(k)))
      .map((r: any) => ({
        name: r.KEYSTAT_NAME,
        value: parseFloat(r.DATA_VALUE),
        prevValue: null, change: null, changePct: null,
        unit: r.UNIT_NAME,
        date: r.CYCLE,
        source: "한국은행 ECOS",
      }));

    const macro = rows
      .filter((r: any) => macroKeywords.some(k => r.KEYSTAT_NAME?.includes(k)))
      .map((r: any) => ({
        name: r.KEYSTAT_NAME,
        value: parseFloat(r.DATA_VALUE),
        prevValue: null, change: null, changePct: null,
        unit: r.UNIT_NAME,
        date: r.CYCLE,
        source: "한국은행 ECOS",
      }));

    logger.info({ fx: fx.length, macro: macro.length }, "ECOS KeyStatisticList fetched");
    return { fx, macro };
  } catch (err) {
    logger.error({ err }, "ECOS KeyStatisticList fetch error");
    return { fx: [], macro: [] };
  }
}

// ── FAO 식품가격지수 (공식 CSV 직접 파싱) ──────────────────
// FAO가 매달 공개 발표 페이지에 올리는 공식 CSV를 사용.
// 컬럼: Date, Food Price Index, Meat, Dairy, Cereals, Oils, Sugar
// fenixservices/faostatservices API는 인증 게이트웨이로 막혀있어 이 방식이 더 안정적임
const FAO_CSV_URL =
  "https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data.csv";

const FAO_SUBINDEX_LABELS: { key: "fpi" | "meat" | "dairy" | "cereals" | "oils" | "sugar"; name: string; symbol: string }[] = [
  { key: "fpi", name: "FAO 식품가격지수", symbol: "FFPI" },
  { key: "meat", name: "FAO 육류가격지수", symbol: "FAO-Meat" },
  { key: "dairy", name: "FAO 유제품가격지수", symbol: "FAO-Dairy" },
  { key: "cereals", name: "FAO 곡물가격지수", symbol: "FAO-Cereals" },
  { key: "oils", name: "FAO 식물성유지가격지수", symbol: "FAO-Oils" },
  { key: "sugar", name: "FAO 설탕가격지수", symbol: "FAO-Sugar" },
];

export async function fetchFAOFoodPriceIndex() {
  try {
    const res = await axios.get(FAO_CSV_URL, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoodNewsDashboard/1.0)" },
      responseType: "text",
    });
    const csv: string = res.data;

    // 데이터 행만 추출: "YYYY-MM,val,val,val,val,val,val,..." 형태
    const lines = csv.split("\n").filter((line) => /^\d{4}-\d{2},/.test(line.trim()));
    if (lines.length === 0) {
      logger.warn("FAO CSV: no data rows matched");
      return [];
    }

    const parseRow = (line: string) => {
      const cols = line.split(",");
      return {
        date: cols[0],
        fpi: parseFloat(cols[1]),
        meat: parseFloat(cols[2]),
        dairy: parseFloat(cols[3]),
        cereals: parseFloat(cols[4]),
        oils: parseFloat(cols[5]),
        sugar: parseFloat(cols[6]),
      };
    };

    const latest = parseRow(lines[lines.length - 1]);
    const prev = lines.length >= 2 ? parseRow(lines[lines.length - 2]) : null;

    return FAO_SUBINDEX_LABELS.map(({ key, name, symbol }) => {
      const value = latest[key];
      const prevValue = prev ? prev[key] : null;
      const change = prevValue != null && !Number.isNaN(prevValue) ? value - prevValue : null;
      const changePct = change != null && prevValue ? (change / prevValue) * 100 : null;
      return {
        name,
        symbol,
        value,
        prevValue,
        change,
        changePct,
        unit: "Index (2014-2016=100)",
        date: latest.date,
        source: "FAO",
      };
    }).filter((d) => !Number.isNaN(d.value));
  } catch (err) {
    logger.error({ err }, "FAO CSV fetch error");
    return [];
  }
}

// ── 전체 수집 ────────────────────────────────────────
export async function fetchAllMarketData() {
  const [oil, commodities, ecos, fao] = await Promise.all([
    fetchOilPrices(),
    fetchCommodityPrices(),
    fetchECOSKeyStats(),
    fetchFAOFoodPriceIndex(),
  ]);
  return {
    oil,
    commodities,
    fx: ecos.fx,
    macro: ecos.macro,
    fao,
    updatedAt: new Date().toISOString(),
  };
}