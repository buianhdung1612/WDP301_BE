import { Router } from 'express';
const router = Router();
import * as controller from '../../controllers/client/review.controller';

import * as authMiddleware from '../../middlewares/client/auth.middleware';

router.get('/my-reviews', authMiddleware.requireAuth, controller.getMyReviews);
router.get('/:productId', controller.getReviews);
router.post('/create', authMiddleware.requireAuth, controller.createReview);
router.patch('/update/:id', authMiddleware.requireAuth, controller.updateReview);

export default router;
