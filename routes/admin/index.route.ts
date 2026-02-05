import { Router } from "express";
import articleRoutes from "./article.route"
import couponRoutes from "./coupon.route"
import brandRoutes from "./brand.route"
import productRoutes from "./product.route"
import bookingRoutes from "./booking.route"
import serviceRoutes from "./service.route"
import roleRoutes from "./role.route"
import accountAdminRoutes from "./account-admin.route"

const router = Router();

router.use('/article', articleRoutes);
router.use('/coupon', couponRoutes);
router.use('/brand', brandRoutes);
router.use('/product', productRoutes);
router.use('/service', serviceRoutes);
router.use('/role', roleRoutes);
router.use('/account-admin', accountAdminRoutes);
// router.use('/', bookingRoutes);

export default router;