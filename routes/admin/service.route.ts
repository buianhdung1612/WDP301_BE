import { Router } from "express";
import * as controller from "../../controllers/admin/service.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

// Categories
router.get("/categories", checkPermission("service_category_view"), controller.categoryList);
router.get("/categories/tree", checkPermission("service_category_view"), controller.categoryTree);
router.get("/categories/detail/:id", checkPermission("service_category_view"), controller.categoryDetail);
router.post("/categories/create", checkPermission("service_category_create"), controller.categoryCreate);
router.patch("/categories/edit/:id", checkPermission("service_category_edit"), controller.categoryEdit);
router.delete("/categories/delete/:id", checkPermission("service_category_delete"), controller.categoryDelete);
router.patch("/categories/restore/:id", checkPermission("service_category_delete"), controller.categoryRestore);
router.delete("/categories/force-delete/:id", checkPermission("service_category_delete"), controller.categoryForceDelete);

// Services
router.get("/", checkPermission("service_view"), controller.serviceList);
router.get("/detail/:id", checkPermission("service_view"), controller.serviceDetail);
router.post("/create", checkPermission("service_create"), controller.serviceCreate);
router.patch("/edit/:id", checkPermission("service_edit"), controller.serviceEdit);
router.delete("/delete/:id", checkPermission("service_delete"), controller.serviceDelete);
router.patch("/restore/:id", checkPermission("service_delete"), controller.serviceRestore);
router.delete("/force-delete/:id", checkPermission("service_delete"), controller.serviceForceDelete);

export default router;
