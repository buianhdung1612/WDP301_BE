import { Router } from "express";
import * as controller from "../../../controllers/client/boarding-care-template.controller";

const router = Router();

router.get("/food", controller.getFoodTemplates);
router.get("/exercise", controller.getExerciseTemplates);

export default router;
