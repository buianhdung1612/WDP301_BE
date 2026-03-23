import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller"
import passport from "passport";

import * as authValidate from "../../validates/client/auth.validate";
import * as authMiddleware from "../../middlewares/client/auth.middleware";

const router = Router();

router.post("/register", authValidate.registerPost, authController.registerPost);
router.post("/login", authValidate.loginPost, authController.loginPost);
router.post("/logout", authController.logout);

router.post("/forgot-password", authValidate.forgotPasswordPost, authController.forgotPasswordPost);
router.post("/otp-password", authValidate.otpPasswordPost, authController.otpPasswordPost);
router.post("/reset-password", authValidate.resetPasswordPost, authController.resetPasswordPost);

router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
}));

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/login',
}), authController.callbackGoogle);

router.get('/facebook', passport.authenticate('facebook', {
    scope: ['email'],
}));

router.get('/facebook/callback', passport.authenticate('facebook', {
    failureRedirect: '/auth/login',
}), authController.callbackFacebook);

router.get("/me", authMiddleware.requireAuth, authController.getMe);

export default router;
