import { Router } from "express";
import * as controller from "../../controllers/admin/role.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/list", checkPermission("role_view"), controller.list);
router.post("/create", checkPermission("role_create"), controller.create);
router.get("/detail/:id", checkPermission("role_view"), controller.detail);
router.patch("/edit/:id", checkPermission("role_edit"), controller.edit);
router.delete("/delete/:id", checkPermission("role_delete"), controller.deleteRole);

export default router;
