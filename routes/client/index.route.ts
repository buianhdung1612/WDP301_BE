import { Router } from "express";
import bookingRoutes from "./booking.route";
import productRoutes from "./product.route"
import authRoutes from "./auth.route"
import cartRoutes from "./cart.route"
import dashboardRoutes from "./dashboard.route"
import { orderRoutes } from "./order.route"

const router = Router();

router.use('/booking', bookingRoutes);
router.use('/auth', authRoutes);
router.use('/product', productRoutes);
router.use('/cart', cartRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/order', orderRoutes);

export default router;