import { Router } from "express";
import * as controller from "../../controllers/admin/work-schedule.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/", checkPermission("schedule_view"), controller.index);
router.get("/my-schedule", checkPermission("schedule_view"), controller.listMySchedules);
router.get("/calendar", checkPermission("schedule_view"), controller.getCalendarData);
router.post("/", checkPermission("schedule_create"), controller.create);
router.post("/bulk", checkPermission("schedule_create"), controller.bulkCreate);
router.post("/bulk-delete", checkPermission("schedule_delete"), controller.bulkRemove);
router.patch("/:id", checkPermission("schedule_edit"), controller.update);
router.post("/:id/check-in", checkPermission("attendance_edit"), controller.checkIn);
router.post("/:id/check-out", checkPermission("attendance_edit"), controller.checkOut);
router.delete("/:id", checkPermission("schedule_delete"), controller.remove);

export default router;
