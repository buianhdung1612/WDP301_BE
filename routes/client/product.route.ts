import { Router } from "express";
import * as productController from "../../controllers/client/product.controller";

const router = Router();

router.get("/", productController.index);
router.get("/detail/:slug", productController.detail);

export default router;
