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

// Sản phẩm
router.get('/list', productController.list);
router.get('/create', productController.create);
router.post(
    '/create',
    productValidate.createPost,
    productController.createPost
);
router.get('/edit/:id', productController.edit);
router.patch(
    '/edit/:id',
    productValidate.createPost,
    productController.editPatch
);
router.patch('/delete/:id', productController.deletePatch);

// Thuộc tính
router.get('/attribute/list', productController.getAttributeList);
router.get('/attribute/detail/:id', productController.getAttributeDetail);
router.post(
    '/attribute/create',
    productValidate.createAttributePost,
    productController.createAttribute
);
router.patch(
    '/attribute/edit/:id',
    productValidate.createAttributePost,
    productController.updateAttribute
);
router.patch('/attribute/delete/:id', productController.deleteAttribute);

// Import/Export
// router.get('/export-csv', productController.exportCSV);
// router.post(
//     '/import-csv',
//     productController.importCSVPost
// );

export default router;
