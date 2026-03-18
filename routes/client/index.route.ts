import { Router } from "express";
import bookingRoutes from "./booking.route";
import productRoutes from "./product.route"
import authRoutes from "./auth.route"
import cartRoutes from "./cart.route"
import dashboardRoutes from "./dashboard.route"
import { orderRoutes } from "./order.route"
import petRoutes from "./pet.route"
import serviceRoutes from "./service.route"
import boardingBookingRoutes from "./boarding-booking.route"
import cageRoutes from "./boarding-cages.route"
import articleRoutes from "./article.route";
import breedRoutes from "./breed.route";
import couponRoutes from "./coupon.route";
import reviewRoutes from "./review.route";

const router = Router();

router.use('/booking', bookingRoutes);
router.use('/auth', authRoutes);
router.use('/product', productRoutes);
router.use('/service', serviceRoutes);
router.use('/cart', cartRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/order', orderRoutes);
router.use('/pet', petRoutes);
router.use('/boarding', boardingBookingRoutes);
router.use('/cage', cageRoutes);
router.use('/article', articleRoutes);
router.use('/breed', breedRoutes);
router.use('/coupon', couponRoutes);
router.use('/review', reviewRoutes);

export default router;
