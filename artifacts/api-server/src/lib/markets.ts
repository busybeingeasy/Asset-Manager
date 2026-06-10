import axios from "axios";
import { logger } from "./logger";

// ── EIA 유가 (WTI, 브렌트유) ──────────────────────────
export async function fetchOilPrices() {
  const key = process.env.EIA_API_KEY;
  if (!key) { logger.warn("EIA_API_KEY 없음"); return []; }
  try {
    const [wti, brent] = await Promise.all([
      axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`),
      axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`),
    ]);
    const wtiData = wti.data?.response?.data?.[0];
    const brentData = brent.data?.response?.data?.[0];
    return [
      { name: "WTI유", symbol: "WTI", value: wtiData?.value, unit: "USD/배럴", date: wtiData?.period, source: "EIA" },
      { name: "브렌트유", symbol: "BRENT", value: brentData?.value, unit: "USD/배럴", date: brentData?.period, source: "EIA" },
    ].filter(d => d.value != null);
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
  const results = [];
  for (const c of AV_COMMODITIES) {
    try {
      const res = await axios.get(`https://www.alphavantage.co/query?function=${c.symbol}&interval=monthly&apikey=${key}`);
      const data = res.data?.data?.[0];
      if (data) {
        results.push({ name: c.name, symbol: c.symbol, value: parseFloat(data.value), unit: c.unit, date: data.date, source: "Alpha Vantage" });
      }
      await new Promise(r => setTimeout(r, 1200)); // rate limit
    } catch (err) { logger.error({ err, symbol: c.symbol }, "AV fetch error"); }
  }
  return results;
}

// ── 한국은행 ECOS 환율 + 거시지표 ───────────────────────
const ECOS_BASE = "https://ecos.bok.or.kr/api";

async function fetchECOS(statCode: string, itemCode: string, name: string, unit: string) {
  const key = process.env.ECOS_API_KEY;
  if (!key) return null;
  try {
    const today = new Date();
    const yyyymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const from = `${today.getFullYear() - 1}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const url = `${ECOS_BASE}/StatisticSearch/${key}/json/kr/1/5/${statCode}/MM/${from}/${yyyymm}/${itemCode}`;
    const res = await axios.get(url, { timeout: 10000 });
    const rows = res.data?.StatisticSearch?.row ?? [];
    if (rows.length === 0) return null;
    const latest = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const value = parseFloat(latest.DATA_VALUE);
    const prevValue = prev ? parseFloat(prev.DATA_VALUE) : null;
    const change = prevValue ? value - prevValue : null;
    const changePct = prevValue ? ((value - prevValue) / prevValue) * 100 : null;
    return { name, value, prevValue, change, changePct, unit, date: latest.TIME, source: "한국은행 ECOS" };
  } catch (err) { logger.error({ err, statCode }, "ECOS fetch error"); return null; }
}

export async function fetchExchangeRates() {
  const [usd, eur, jpy, cny] = await Promise.all([
    fetchECOS("731Y001", "0000001", "USD/KRW", "원"),
    fetchECOS("731Y001", "0000002", "EUR/KRW", "원"),
    fetchECOS("731Y001", "0000003", "JPY/KRW(100엔)", "원"),
    fetchECOS("731Y001", "0000004", "CNY/KRW", "원"),
  ]);
  return [usd, eur, jpy, cny].filter(Boolean);
}

export async function fetchMacroIndicators() {
  const [cpi, ppi, rate] = await Promise.all([
    fetchECOS("901Y009", "0", "소비자물가지수 (CPI)", "%"),
    fetchECOS("404Y014", "AAAAAA", "생산자물가지수 (PPI)", "%"),
    fetchECOS("722Y001", "0101000", "기준금리", "%"),
  ]);
  return [cpi, ppi, rate].filter(Boolean);
}

// ── FAO 식품가격지수 ──────────────────────────────────
export async function fetchFAOFoodPriceIndex() {
  try {
    const res = await axios.get(
      "https://fenixservices.fao.org/faostat/api/v1/data/FPPI?area=5000&item=23013&element=6132&year=2023,2024,2025&format=json",
      { timeout: 15000 }
    );
    const rows = res.data?.data ?? [];
    if (rows.length === 0) return [];
    const sorted = rows.sort((a: any, b: any) => b.Year - a.Year || b.Months - a.Months);
    return sorted.slice(0, 6).map((r: any) => ({
      name: "FAO 식품가격지수",
      symbol: "FFPI",
      value: r.Value,
      unit: "Index",
      date: `${r.Year}-${String(r.Months).padStart(2, "0")}`,
      source: "FAO",
    }));
  } catch (err) { logger.error({ err }, "FAO fetch error"); return []; }
}

// ── 전체 수집 ────────────────────────────────────────
export async function fetchAllMarketData() {
  const [oil, commodities, fx, macro, fao] = await Promise.all([
    fetchOilPrices(),
    fetchCommodityPrices(),
    fetchExchangeRates(),
    fetchMacroIndicators(),
    fetchFAOFoodPriceIndex(),
  ]);
  return { oil, commodities, fx, macro, fao, updatedAt: new Date().toISOString() };
}
