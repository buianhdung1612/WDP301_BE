import { Router } from "express";
import articleRoutes from "./article.route"
import couponRoutes from "./coupon.route"

const router = Router();

router.use('/article', articleRoutes);
router.use('/coupon', couponRoutes);

export default router;