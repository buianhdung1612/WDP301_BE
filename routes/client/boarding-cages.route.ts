import { Router } from "express";
import * as serviceController from "../../controllers/client/service.controller";
import * as bookingController from "../../controllers/client/booking.controller";
import * as boardingCageController from "../../controllers/client/boarding-cage.controller";
import { infoAuth, requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

// ================= SERVICES =================

router.use(requireAuth); // ⭐⭐⭐ BẮT BUỘC ⭐⭐

// ================= BOARDING CAGES =================
router.get("/boarding-cages", boardingCageController.getAllBoardingCages);
router.post("/boarding-cages", boardingCageController.createBoardingCage);
router.patch("/boarding-cages/:id", boardingCageController.updateCageStatus);
router.delete("/boarding-cages/:id", boardingCageController.deleteBoardingCage);
router.get(
  "/boarding-cages/available",
  boardingCageController.listAvailableCages
);


export default router;
