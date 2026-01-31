// routes/client/pet.route.ts
import { Router } from "express";
import * as petController from "../../controllers/client/pet.controller";
import { requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/my-pets", petController.listMyPets);
router.get("/my-pets/:id", petController.getMyPet);
router.post("/my-pets", petController.createPet);
router.patch("/my-pets/:id", petController.updateMyPet);
router.delete("/my-pets/:id", petController.deleteMyPet);

export default router;
