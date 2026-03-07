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

// Services
router.get("/", checkPermission("service_view"), controller.serviceList);
router.get("/detail/:id", checkPermission("service_view"), controller.serviceDetail);
router.post("/create", checkPermission("service_create"), controller.serviceCreate);
router.patch("/edit/:id", checkPermission("service_edit"), controller.serviceEdit);
router.delete("/delete/:id", checkPermission("service_delete"), controller.serviceDelete);

export default router;
