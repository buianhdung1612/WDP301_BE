import { Router } from "express";
import * as controller from "../../controllers/client/time-slot.controller";

const router = Router();

router.get("/", controller.listTimeSlots);

export default router;
