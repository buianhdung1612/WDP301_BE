import { Router } from "express";
import * as controller from "../../controllers/admin/account-admin.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/list", checkPermission("account_admin_view"), controller.list);
router.get("/staff-by-service", controller.getStaffByService);

router.post("/create", checkPermission("account_admin_create"), controller.create);
router.get("/detail/:id", checkPermission("account_admin_view"), controller.detail);
router.patch("/edit/:id", checkPermission("account_admin_edit"), controller.edit);
router.patch("/change-password/:id", checkPermission("account_admin_edit"), controller.changePassword);
router.delete("/delete/:id", checkPermission("account_admin_delete"), controller.deleteAccount);

export default router;
