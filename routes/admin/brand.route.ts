import { Router } from "express";
import * as brandController from "../../controllers/admin/brand.controller";
import * as brandValidate from "../../validates/admin/brand.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get('/', checkPermission("brand_view"), brandController.list);
router.get('/detail/:id', checkPermission("brand_view"), brandController.detail);
router.post(
    '/',
    checkPermission("brand_create"),
    brandValidate.create,
    brandController.create
);

router.patch(
    '/edit/:id',
    checkPermission("brand_edit"),
    brandValidate.create,
    brandController.edit
);
router.patch('/delete/:id', checkPermission("brand_delete"), brandController.deletePatch);

export default router;