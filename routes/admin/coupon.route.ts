import { Router } from "express";
import * as couponController from "../../controllers/admin/coupon.controller";
import * as couponValidate from "../../validates/admin/coupon.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/', checkPermission("coupon_view"), couponController.list);
router.get('/detail/:id', checkPermission("coupon_view"), couponController.detail);
router.post(
    '/',
    checkPermission("coupon_create"),
    couponValidate.create,
    couponController.create
);

router.patch(
    '/edit/:id',
    checkPermission("coupon_edit"),
    couponValidate.create,
    couponController.edit
);
router.patch('/delete/:id', checkPermission("coupon_delete"), couponController.deletePatch);

export default router;