import { Router } from 'express';
import * as controller from '../../controllers/admin/dashboard.controller';

const router = Router();

router.get('/ecommerce-stats', controller.getEcommerceStats);
router.get('/analytics-stats', controller.getAnalyticsStats);
router.get('/system-stats', controller.getSystemStats);
router.get('/staffing-status', controller.getStaffingStatus);
router.get('/boarding-stats', controller.getBoardingStats);

export default router;
