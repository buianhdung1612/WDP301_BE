import { Router } from "express";
import * as controller from "../../controllers/admin/setting.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router: Router = Router();

router.get("/general", checkPermission("settings_view"), controller.getGeneral);
router.patch("/general", checkPermission("settings_edit"), controller.updateGeneral);

export const settingRoutes: Router = router;
