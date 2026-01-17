import { Router } from "express";
import articleRoutes from "./article.route"
import couponRoutes from "./coupon.route"
import brandRoutes from "./brand.route"

const router = Router();

router.use('/article', articleRoutes);
router.use('/coupon', couponRoutes);
router.use('/brand', brandRoutes);

export default router;