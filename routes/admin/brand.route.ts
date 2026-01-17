import { Router } from "express";
import * as brandController from "../../controllers/admin/brand.controller";
import * as brandValidate from "../../validates/admin/brand.validate";

const router = Router();

router.get('/', brandController.list);
router.get('/detail/:id', brandController.detail);
router.post(
    '/',
    brandValidate.create,
    brandController.create
);

router.patch(
    '/edit/:id',
    brandValidate.create,
    brandController.edit
);
router.patch('/delete/:id', brandController.deletePatch);

export default router;