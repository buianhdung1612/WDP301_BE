import { Router } from "express";
import * as couponController from "../../controllers/admin/coupon.controller";
import * as couponValidate from "../../validates/admin/coupon.validate";

const router = Router();

router.get('/', couponController.list);
router.get('/detail/:id', couponController.detail);
router.post(
    '/',
    couponValidate.create,
    couponController.create
);

router.patch(
    '/edit/:id',
    couponValidate.create,
    couponController.edit
);
router.patch('/delete/:id', couponController.deletePatch);

export default router;