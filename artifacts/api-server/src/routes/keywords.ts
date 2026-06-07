import { Router, type IRouter } from "express";
import { GetKeywordConfigResponse, SaveKeywordConfigBody } from "@workspace/api-zod";
import { getKeywordConfig, saveKeywordConfig } from "../lib/keywords";

const router: IRouter = Router();

router.get("/keywords", (_req, res): void => {
  res.json(GetKeywordConfigResponse.parse(getKeywordConfig()));
});

router.put("/keywords", async (req, res): Promise<void> => {
  const parsed = SaveKeywordConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const saved = saveKeywordConfig(parsed.data);
  res.json(GetKeywordConfigResponse.parse(saved));
});

export default router;

import { getFoodFilterKeywords, saveFoodFilterKeywords } from "../lib/keywords";

router.get("/keywords/food-filter", (_req, res): void => {
  res.json(getFoodFilterKeywords());
});

router.put("/keywords/food-filter", async (req, res): Promise<void> => {
  const keywords = req.body;
  if (!Array.isArray(keywords)) {
    res.status(400).json({ error: "keywords must be an array" });
    return;
  }
  res.json(saveFoodFilterKeywords(keywords));
});
