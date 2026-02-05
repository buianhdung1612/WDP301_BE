import { Router } from "express";
import * as controller from "../../controllers/admin/account-admin.controller";

const router = Router();

router.get("/list", controller.list);
router.post("/create", controller.create);
router.get("/detail/:id", controller.detail);
router.patch("/edit/:id", controller.edit);
router.patch("/change-password/:id", controller.changePassword);
router.delete("/delete/:id", controller.deleteAccount);

export default router;
