import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import * as productValidate from "../../validates/admin/product.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

// Danh mục sản phẩm
router.get('/category/list', checkPermission("product_category_view"), productController.category);
router.get('/category/tree', checkPermission("product_category_view"), productController.getCategoryTree);
router.get('/category/detail/:id', checkPermission("product_category_view"), productController.getCategoryDetail);
router.post(
    '/category/create',
    checkPermission("product_category_create"),
    productValidate.createCategory,
    productController.createCategory
);
router.patch(
    '/category/edit/:id',
    checkPermission("product_category_edit"),
    productValidate.createCategory,
    productController.editCategory
);
router.patch('/category/delete/:id', checkPermission("product_category_delete"), productController.deleteCategory);
router.patch('/category/restore/:id', checkPermission("product_category_delete"), productController.restoreCategory);
router.delete('/category/force-delete/:id', checkPermission("product_category_delete"), productController.forceDeleteCategory);

// Sản phẩm
router.get('/list', checkPermission("product_view"), productController.list);
router.get('/create', checkPermission("product_create"), productController.create);
router.post(
    '/create',
    checkPermission("product_create"),
    productValidate.createPost,
    productController.createPost
);
router.get('/edit/:id', checkPermission("product_edit"), productController.edit);
router.patch(
    '/edit/:id',
    checkPermission("product_edit"),
    productValidate.createPost,
    productController.editPatch
);
router.patch('/delete/:id', checkPermission("product_delete"), productController.deletePatch);
router.patch('/restore/:id', checkPermission("product_delete"), productController.restoreProduct);
router.delete('/force-delete/:id', checkPermission("product_delete"), productController.forceDeleteProduct);
router.get('/expired/list', checkPermission("product_view"), productController.expiredList);
router.post('/expired/scan', checkPermission("product_edit"), productController.scanExpiredProducts);

// Thuộc tính
router.get('/attribute/list', checkPermission("product_attribute_view"), productController.getAttributeList);
router.get('/attribute/detail/:id', checkPermission("product_attribute_view"), productController.getAttributeDetail);
router.post(
    '/attribute/create',
    checkPermission("product_attribute_create"),
    productValidate.createAttributePost,
    productController.createAttribute
);
router.patch(
    '/attribute/edit/:id',
    checkPermission("product_attribute_edit"),
    productValidate.createAttributePost,
    productController.updateAttribute
);
router.patch('/attribute/delete/:id', checkPermission("product_attribute_delete"), productController.deleteAttribute);
router.patch('/attribute/restore/:id', checkPermission("product_attribute_delete"), productController.restoreAttribute);
router.delete('/attribute/force-delete/:id', checkPermission("product_attribute_delete"), productController.forceDeleteAttribute);

export default router;
