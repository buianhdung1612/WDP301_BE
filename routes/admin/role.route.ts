import { Router } from "express";
import * as controller from "../../controllers/admin/role.controller";

const router = Router();

router.get("/list", controller.list);
router.post("/create", controller.create);
router.get("/detail/:id", controller.detail);
router.patch("/edit/:id", controller.edit);
router.delete("/delete/:id", controller.deleteRole);

export default router;
