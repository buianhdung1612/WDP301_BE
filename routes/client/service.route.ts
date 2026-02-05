import { Router } from "express";
import * as controller from "../../controllers/client/service.controller";

const router = Router();

router.get("/", controller.listServices);
router.get("/detail/:id", controller.getService);
router.get("/categories", controller.getCategories);

export default router;
