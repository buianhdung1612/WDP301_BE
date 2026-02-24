import { Router } from "express";
import * as authController from "../../controllers/admin/auth.controller";
import * as authMiddleware from "../../middlewares/admin/auth.middleware";

const router = Router();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authMiddleware.verifyToken, authController.getMe);

export default router;
