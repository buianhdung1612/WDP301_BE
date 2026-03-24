import { Router } from "express";
import * as controller from "../../controllers/admin/boarding-pet-diary.controller";

const router = Router();

router.get("/", controller.index);
router.post("/upsert", controller.upsertRecord);

export default router;
