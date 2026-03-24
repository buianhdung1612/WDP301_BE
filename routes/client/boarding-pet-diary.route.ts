import { Router } from "express";
import * as controller from "../../controllers/client/boarding-pet-diary.controller";

import { requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", controller.index);

export default router;
