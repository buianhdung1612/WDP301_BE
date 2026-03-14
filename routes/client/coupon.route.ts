import { Router } from "express";
import * as couponController from "../../controllers/client/coupon.controller";

const router = Router();

router.get('/list', couponController.list);
router.post('/check', couponController.checkCoupon);

export default router;
