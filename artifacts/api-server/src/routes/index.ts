import { Router, type IRouter } from "express";
import healthRouter from "./health";
import newsRouter from "./news";
import scheduleRouter from "./schedule";
import sheetsRouter from "./sheets";
import keywordsRouter from "./keywords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(newsRouter);
router.use(scheduleRouter);
router.use(sheetsRouter);
router.use(keywordsRouter);

export default router;
