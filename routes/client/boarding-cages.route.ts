import { Router } from "express";
import * as boardingCageController from "../../controllers/client/boarding-cage.controller";
import { requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

// ================= BOARDING CAGES =================
router.get(
  "/boarding-cages/available",
  boardingCageController.listAvailableCages
);
router.get(
  "/boarding-cages/:id/reviews",
  boardingCageController.listBoardingCageReviews
);
router.post(
  "/boarding-cages/:id/reviews",
  requireAuth,
  boardingCageController.createBoardingCageReview
);
router.get("/boarding-cages/:id", boardingCageController.getBoardingCageDetail);
router.get("/boarding-cages", requireAuth, boardingCageController.getAllBoardingCages);
router.post("/boarding-cages", requireAuth, boardingCageController.createBoardingCage);
router.patch("/boarding-cages/:id", requireAuth, boardingCageController.updateCageStatus);
router.delete("/boarding-cages/:id", requireAuth, boardingCageController.deleteBoardingCage);


export default router;
