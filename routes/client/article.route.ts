import { Router } from 'express';
import * as controller from '../../controllers/client/article.controller';

const router = Router();

router.get('/list', controller.list);
router.get('/detail/:slug', controller.detail);

export default router;
