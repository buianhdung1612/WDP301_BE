import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import * as productValidate from "../../validates/admin/product.validate";

const router = Router();

// Danh mục sản phẩm
router.get('/category/list', productController.category);
router.get('/category/tree', productController.getCategoryTree);
router.get('/category/detail/:id', productController.getCategoryDetail);
router.post(
    '/category/create',
    productValidate.createCategory,
    productController.createCategory
);
router.patch(
    '/category/edit/:id',
    productValidate.createCategory,
    productController.editCategory
);
router.patch('/category/delete/:id', productController.deleteCategory);


export default router;