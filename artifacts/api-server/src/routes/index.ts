import { Router, type IRouter } from "express";
import healthRouter from "./health";
import newsRouter from "./news";
import scheduleRouter from "./schedule";

const router: IRouter = Router();

router.use(healthRouter);
router.use(newsRouter);
router.use(scheduleRouter);

export default router;
