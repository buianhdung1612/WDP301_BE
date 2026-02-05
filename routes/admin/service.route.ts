import { Router } from "express";
import * as controller from "../../controllers/admin/service.controller";

const router = Router();

// Categories
router.get("/categories", controller.categoryList);
router.get("/categories/tree", controller.categoryTree);
router.get("/categories/detail/:id", controller.categoryDetail);
router.post("/categories/create", controller.categoryCreate);
router.patch("/categories/edit/:id", controller.categoryEdit);
router.delete("/categories/delete/:id", controller.categoryDelete);

// Services
router.get("/", controller.serviceList);
router.get("/detail/:id", controller.serviceDetail);
router.post("/create", controller.serviceCreate);
router.patch("/edit/:id", controller.serviceEdit);
router.delete("/delete/:id", controller.serviceDelete);

export default router;
