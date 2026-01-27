import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller"

import * as authValidate from "../../validates/client/auth.validate";

const router = Router();

router.post("/register", authValidate.registerPost, authController.registerPost);
router.post("/login", authValidate.loginPost, authController.loginPost);
router.post("/logout", authController.logout);

router.post("/forgot-password", authValidate.forgotPasswordPost, authController.forgotPasswordPost);
router.post("/otp-password", authValidate.otpPasswordPost, authController.otpPasswordPost);
router.post("/reset-password", authValidate.resetPasswordPost, authController.resetPasswordPost);

export default router;
