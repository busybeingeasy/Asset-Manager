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
