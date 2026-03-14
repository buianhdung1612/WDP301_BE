import { Router } from "express";
import * as cartController from "../../controllers/client/cart.controller";

import { infoAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

router.post("/list", infoAuth, cartController.list);

export default router;
