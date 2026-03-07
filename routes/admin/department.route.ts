import { Router } from "express";
import * as controller from "../../controllers/admin/department.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/", checkPermission("department_view"), controller.index);
router.get("/:id", checkPermission("department_view"), controller.detail);
router.post("/", checkPermission("department_create"), controller.create);
router.patch("/:id", checkPermission("department_edit"), controller.update);
router.delete("/:id", checkPermission("department_delete"), controller.remove);

export default router;
