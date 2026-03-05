// routes/client/breed.route.ts
import { Router } from "express";
import * as breedController from "../../controllers/client/breed.controller";

const router = Router();

router.get("/", breedController.listBreeds);
router.post("/create", breedController.createBreed);

export default router;
