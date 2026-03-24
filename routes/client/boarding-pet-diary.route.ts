import { Router } from "express";
import * as controller from "../../controllers/client/boarding-pet-diary.controller";

const router = Router();

router.get("/", controller.index);

export default router;
