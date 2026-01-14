import { Router } from "express";
import * as articleController from "../../controllers/admin/article.controller";
import * as articleValidate from "../../validates/admin/article.validate";

const router = Router();

// Danh mục bài viết
router.get('/category', articleController.category);
router.get('/category/tree', articleController.getCategoryTree);
router.get('/category/detail/:id', articleController.getCategoryDetail);
router.post(
    '/category/create',
    articleValidate.createCategory,
    articleController.createCategory
);
router.patch(
    '/category/edit/:id',
    articleValidate.createCategory,
    articleController.editCategory
);
router.patch('/category/delete/:id', articleController.deleteCategory);

// Bài viết
router.get('/list', articleController.list);
router.get('/detail/:id', articleController.detail);
router.post(
    '/',
    articleValidate.createBlog,
    articleController.create
);

router.patch(
    '/edit/:id',
    articleValidate.createBlog,
    articleController.edit
);
router.patch('/delete/:id', articleController.deleteBlog);

export default router;