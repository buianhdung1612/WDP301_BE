import { Router } from "express";
import * as articleController from "../../controllers/admin/article.controller";
import * as articleValidate from "../../validates/admin/article.validate";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

// Danh mục bài viết
router.get('/category', checkPermission("blog_category_view"), articleController.category);
router.get('/category/tree', checkPermission("blog_category_view"), articleController.getCategoryTree);
router.get('/category/detail/:id', checkPermission("blog_category_view"), articleController.getCategoryDetail);
router.post(
    '/category/create',
    checkPermission("blog_category_create"),
    articleValidate.createCategory,
    articleController.createCategory
);
router.patch(
    '/category/edit/:id',
    checkPermission("blog_category_edit"),
    articleValidate.createCategory,
    articleController.editCategory
);
router.patch('/category/delete/:id', checkPermission("blog_category_delete"), articleController.deleteCategory);
router.patch('/category/restore/:id', checkPermission("blog_category_delete"), articleController.restoreCategory);
router.delete('/category/force-delete/:id', checkPermission("blog_category_delete"), articleController.forceDeleteCategory);

// Bài viết
router.get('/list', checkPermission("blog_view"), articleController.list);
router.get('/detail/:id', checkPermission("blog_view"), articleController.detail);
router.post(
    '/',
    checkPermission("blog_create"),
    articleValidate.createBlog,
    articleController.create
);

router.patch(
    '/edit/:id',
    checkPermission("blog_edit"),
    articleValidate.createBlog,
    articleController.edit
);
router.patch('/delete/:id', checkPermission("blog_delete"), articleController.deleteBlog);
router.patch('/restore/:id', checkPermission("blog_delete"), articleController.restoreBlog);
router.delete('/force-delete/:id', checkPermission("blog_delete"), articleController.forceDeleteBlog);

export default router;