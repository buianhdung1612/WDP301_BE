import { Router } from "express";
import * as controller from "../../controllers/admin/pet-care-template.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

// Food templates
router.get("/food", controller.listFoodTemplates);
router.post("/food", checkPermission("boarding_cage_edit"), controller.createFoodTemplate);
router.patch("/food/:id", checkPermission("boarding_cage_edit"), controller.updateFoodTemplate);
router.delete("/food/:id", checkPermission("boarding_cage_edit"), controller.deleteFoodTemplate);

// Exercise templates
router.get("/exercise", controller.listExerciseTemplates);
router.post("/exercise", checkPermission("boarding_cage_edit"), controller.createExerciseTemplate);
router.patch("/exercise/:id", checkPermission("boarding_cage_edit"), controller.updateExerciseTemplate);
router.delete("/exercise/:id", checkPermission("boarding_cage_edit"), controller.deleteExerciseTemplate);

// Seed data
router.post("/seed", checkPermission("boarding_cage_edit"), controller.seedPetCareTemplates);

export default router;
