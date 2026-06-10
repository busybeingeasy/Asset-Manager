import { Router, type IRouter } from "express";
import { fetchAllMarketData } from "../lib/markets";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MARKETS_FILE = path.join(DATA_DIR, "markets.json");

const router: IRouter = Router();

router.get("/markets", (_req, res): void => {
  try {
    if (fs.existsSync(MARKETS_FILE)) {
      const data = JSON.parse(fs.readFileSync(MARKETS_FILE, "utf8"));
      res.json(data);
    } else {
      res.json({ oil: [], commodities: [], fx: [], macro: [], fao: [], updatedAt: null });
    }
  } catch (err) {
    logger.error({ err }, "Error reading markets file");
    res.status(500).json({ error: "Failed to read market data" });
  }
});

router.post("/markets/refresh", async (_req, res): Promise<void> => {
  try {
    logger.info("Fetching all market data...");
    const data = await fetchAllMarketData();
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MARKETS_FILE, JSON.stringify(data, null, 2));
    res.json({ status: "success", updatedAt: data.updatedAt });
  } catch (err) {
    logger.error({ err }, "Error fetching market data");
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

export default router;
