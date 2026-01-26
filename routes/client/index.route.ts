import { Router } from "express";
import bookingRoutes from "./booking.route";
import productRoutes from "./product.route"
import authRoutes from "./auth.route"

const router = Router();

router.use('/booking', bookingRoutes);
router.use('/auth', authRoutes);
router.use('/product', productRoutes);

export default router;