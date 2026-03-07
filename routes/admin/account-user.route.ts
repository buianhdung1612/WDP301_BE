import { Router } from "express";
import * as controller from "../../controllers/admin/account-user.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/list", checkPermission("account_user_view"), controller.list);
router.post("/create", checkPermission("account_user_create"), controller.create);
router.get("/detail/:id", checkPermission("account_user_view"), controller.detail);
router.patch("/edit/:id", checkPermission("account_user_edit"), controller.edit);
router.patch("/change-password/:id", checkPermission("account_user_edit"), controller.changePassword);
router.delete("/delete/:id", checkPermission("account_user_delete"), controller.deleteAccount);

export default router;
