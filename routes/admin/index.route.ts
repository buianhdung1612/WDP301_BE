import { Router } from "express";
import articleRoutes from "./article.route"
import couponRoutes from "./coupon.route"
import brandRoutes from "./brand.route"
import productRoutes from "./product.route"
import bookingRoutes from "./booking.route"
import serviceRoutes from "./service.route"
import roleRoutes from "./role.route"
import accountAdminRoutes from "./account-admin.route"
import accountUserRoutes from "./account-user.route"
import petRoutes from "./pet.route"
import breedRoutes from "./breed.route"
import settingRoutes from "./setting.route"
import shiftRoutes from "./shift.route"
import workScheduleRoutes from "./work-schedule.route"
import departmentRoutes from "./department.route"
import authRoutes from "./auth.route"
import bookingConfigRoutes from "./booking-config.route"
import boardingCageRoutes from "./boarding-cage.route";
import boardingBookingRoutes from "./boarding-booking.route";
import petCareTemplateRoutes from "./pet-care-template.route";

import orderRoutes from "./order.route"
import dashboardRoutes from "./dashboard.route";
import reviewRoutes from "./review.route";
import notificationRoutes from "./notification.route";
import boardingPetDiaryRoutes from "./boarding-pet-diary.route";

import * as authMiddleware from "../../middlewares/admin/auth.middleware";

const router = Router();

// Routes without authentication
router.use('/auth', authRoutes);

// Protected routes
router.use('/article', authMiddleware.verifyToken, articleRoutes);
router.use('/coupon', authMiddleware.verifyToken, couponRoutes);
router.use('/brand', authMiddleware.verifyToken, brandRoutes);
router.use('/product', authMiddleware.verifyToken, productRoutes);
router.use('/order', authMiddleware.verifyToken, orderRoutes);
router.use('/service', authMiddleware.verifyToken, serviceRoutes);
router.use('/role', authMiddleware.verifyToken, roleRoutes);
router.use('/account-admin', authMiddleware.verifyToken, accountAdminRoutes);
router.use('/account-user', authMiddleware.verifyToken, accountUserRoutes);
router.use('/pet', authMiddleware.verifyToken, petRoutes);
router.use('/breed', authMiddleware.verifyToken, breedRoutes);
router.use('/setting', authMiddleware.verifyToken, settingRoutes);
router.use('/booking', authMiddleware.verifyToken, bookingRoutes);
router.use('/booking-config', authMiddleware.verifyToken, bookingConfigRoutes);
router.use('/shifts', authMiddleware.verifyToken, shiftRoutes);
router.use('/schedules', authMiddleware.verifyToken, workScheduleRoutes);
router.use('/departments', authMiddleware.verifyToken, departmentRoutes);
router.use('/boarding-cage', authMiddleware.verifyToken, boardingCageRoutes);
router.use('/boarding-booking', authMiddleware.verifyToken, boardingBookingRoutes);
router.use('/pet-care-template', authMiddleware.verifyToken, petCareTemplateRoutes);
router.use('/boarding-pet-diary', authMiddleware.verifyToken, boardingPetDiaryRoutes);
router.use('/dashboard', authMiddleware.verifyToken, dashboardRoutes);
router.use('/review', authMiddleware.verifyToken, reviewRoutes);
router.use('/notifications', authMiddleware.verifyToken, notificationRoutes);

export default router;
