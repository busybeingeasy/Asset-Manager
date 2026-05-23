import { Router, type IRouter } from "express";
import { GetScheduleStatusResponse } from "@workspace/api-zod";
import { toggleScheduler, getSchedulerStatus } from "../lib/scheduler";

const router: IRouter = Router();

router.get("/schedule", (_req, res): void => {
  res.json(GetScheduleStatusResponse.parse(getSchedulerStatus()));
});

router.post("/schedule", (_req, res): void => {
  toggleScheduler();
  res.json(GetScheduleStatusResponse.parse(getSchedulerStatus()));
});

export default router;
