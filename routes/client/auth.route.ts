import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller"

import * as authValidate from "../../validates/client/auth.validate";

const router = Router();

router.post("/register", authValidate.registerPost, authController.registerPost);
router.post("/login", authValidate.loginPost, authController.loginPost);
router.post("/logout", authController.logout);

export default router;
