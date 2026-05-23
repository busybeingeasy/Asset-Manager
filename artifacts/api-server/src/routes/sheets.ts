import { Router, type IRouter } from "express";
import { GetSheetsStatusResponse, ExportToSheetsResponse } from "@workspace/api-zod";
import { exportToGoogleSheets, getSheetsStatus } from "../lib/sheets";

const router: IRouter = Router();

router.get("/sheets/status", (_req, res): void => {
  res.json(GetSheetsStatusResponse.parse(getSheetsStatus()));
});

router.post("/sheets/export", async (req, res): Promise<void> => {
  req.log.info("Manual Google Sheets export triggered");
  const result = await exportToGoogleSheets();
  res.json(ExportToSheetsResponse.parse(result));
});

export default router;
