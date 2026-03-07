import { Router } from "express";
import * as controller from "../../controllers/admin/pet.controller";

const router = Router();

router.get("/", controller.listPets);
router.post("/create", controller.createPet);
router.get("/:id", controller.getPet);
router.patch("/:id", controller.updatePet);
router.delete("/:id", controller.deletePet);

export default router;
