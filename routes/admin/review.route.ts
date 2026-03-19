import { Router } from 'express';
const router = Router();
import * as controller from '../../controllers/admin/review.controller';

router.get('/', controller.list);
router.patch('/change-status/:id', controller.changeStatus);
router.delete('/delete/:id', controller.deleteReview);

export default router;
