import { Router } from "express";
const router = Router();
import * as controller from "../../controllers/admin/attendance-config.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

router.get("/", checkPermission("attendance_checkin"), controller.getConfig);
router.patch("/", checkPermission("attendance_edit"), controller.updateConfig);

export default router;
