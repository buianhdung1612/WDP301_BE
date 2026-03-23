import { Router } from "express";
import * as controller from "../../controllers/admin/notification.controller";

const router = Router();

router.get("/", controller.getNotifications);
router.patch("/mark-read/all", controller.markAllAsRead);
router.patch("/mark-read/:id", controller.markAsRead);
router.patch("/archive/all", controller.archiveAllNotifications);
router.patch("/archive/:id", controller.archiveNotification);
router.delete("/all", controller.deleteAllNotifications);
router.delete("/:id", controller.deleteNotification);

export default router;
