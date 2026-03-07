import { Router } from "express";
import * as controller from "../../controllers/admin/booking-config.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/", checkPermission("booking_view"), controller.getConfig);
router.patch("/", checkPermission("booking_edit"), controller.updateConfig);

export default router;
