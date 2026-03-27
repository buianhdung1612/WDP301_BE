import { Router } from "express";
import * as controller from "../../controllers/admin/boarding-config.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/", controller.getBoardingConfig);
router.patch("/", checkPermission("boarding_booking_edit"), controller.updateBoardingConfig);

export default router;
