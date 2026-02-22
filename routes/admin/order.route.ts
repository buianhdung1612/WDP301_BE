import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/list', checkPermission("product_view"), orderController.list);
router.get('/detail/:id', checkPermission("product_view"), orderController.detail);
router.patch('/:id/status', checkPermission("product_view"), orderController.updateStatus);

export default router;
