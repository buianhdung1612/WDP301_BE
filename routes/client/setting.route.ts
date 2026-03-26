import { Router } from "express";
import * as settingController from "../../controllers/client/setting.controller";

const router = Router();

router.get('/page/:key', settingController.getPage);
router.get('/general', settingController.getGeneral);

export default router;
