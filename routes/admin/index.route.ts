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
import { settingRoutes } from "./setting.route"
import seedRoutes from "./seed.route"
import shiftRoutes from "./shift.route"
import workScheduleRoutes from "./work-schedule.route"
import attendanceRoutes from "./attendance.route"
import departmentRoutes from "./department.route"
import attendanceConfigRoutes from "./attendance-config.route"
import authRoutes from "./auth.route"
import bookingConfigRoutes from "./booking-config.route"

import * as authMiddleware from "../../middlewares/admin/auth.middleware";

const router = Router();

// Routes without authentication
router.use('/auth', authRoutes);

// Protected routes
router.use('/article', authMiddleware.verifyToken, articleRoutes);
router.use('/coupon', authMiddleware.verifyToken, couponRoutes);
router.use('/brand', authMiddleware.verifyToken, brandRoutes);
router.use('/product', authMiddleware.verifyToken, productRoutes);
router.use('/service', authMiddleware.verifyToken, serviceRoutes);
router.use('/role', authMiddleware.verifyToken, roleRoutes);
router.use('/account-admin', authMiddleware.verifyToken, accountAdminRoutes);
router.use('/account-user', authMiddleware.verifyToken, accountUserRoutes);
router.use('/pet', authMiddleware.verifyToken, petRoutes);
router.use('/breed', authMiddleware.verifyToken, breedRoutes);
router.use('/setting', authMiddleware.verifyToken, settingRoutes);
router.use('/booking', authMiddleware.verifyToken, bookingRoutes);
router.use('/booking-config', authMiddleware.verifyToken, bookingConfigRoutes);
router.use('/seed', authMiddleware.verifyToken, seedRoutes);
router.use('/shifts', authMiddleware.verifyToken, shiftRoutes);
router.use('/schedules', authMiddleware.verifyToken, workScheduleRoutes);
router.use('/attendance', authMiddleware.verifyToken, attendanceRoutes);
router.use('/departments', authMiddleware.verifyToken, departmentRoutes);
router.use('/attendance-configs', authMiddleware.verifyToken, attendanceConfigRoutes);

export default router;