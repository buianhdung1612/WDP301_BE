import { Router } from "express";
import * as controller from "../../controllers/admin/shift.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/", checkPermission("shift_view"), controller.index);
router.get("/:id", checkPermission("shift_view"), controller.detail);
router.post("/", checkPermission("shift_create"), controller.create);
router.patch("/:id", checkPermission("shift_edit"), controller.update);
router.delete("/:id", checkPermission("shift_delete"), controller.remove);

export default router;
