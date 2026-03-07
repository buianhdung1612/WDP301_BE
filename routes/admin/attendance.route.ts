import { Router } from "express";
import * as controller from "../../controllers/admin/attendance.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/", checkPermission("attendance_view"), controller.index);
router.get("/:id", checkPermission("attendance_view"), controller.detail);
router.post("/generate", checkPermission("attendance_edit"), controller.generate);
router.patch("/:id", checkPermission("attendance_edit"), controller.update);
router.post("/:id/approve", checkPermission("attendance_edit"), controller.approve);
router.delete("/:id", checkPermission("attendance_edit"), controller.remove);

export default router;
