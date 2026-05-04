import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import routesRouter from "./routes.js";
import busesRouter from "./buses.js";
import stopsRouter from "./stops.js";
import searchRouter from "./search.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/routes", routesRouter);
router.use("/buses", busesRouter);
router.use("/stops", stopsRouter);
router.use("/search", searchRouter);

export default router;
