import { Router } from "express";
import * as serviceController from "../../controllers/client/service.controller";
import * as bookingController from "../../controllers/client/booking.controller";
import * as petController from "../../controllers/client/pet.controller";
import * as boardingCageController from "../../controllers/client/boarding-cage.controller";
import * as boardingBookingController from "../../controllers/client/boarding-booking.controller";
import { requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

// ================= SERVICES =================
router.get("/services", serviceController.listServices);
router.get("/services/:id", serviceController.getService);
router.get("/service-categories", serviceController.getCategories);

// ================= SERVICE BOOKINGS =================
router.get("/time-slots", requireAuth, bookingController.getAvailableTimeSlots);
router.get("/bookings", requireAuth, bookingController.listMyBookings);
router.get("/bookings/:id", requireAuth, bookingController.getMyBooking);
router.post("/bookings", requireAuth, bookingController.createBooking);
router.patch("/bookings/:id/cancel", requireAuth, bookingController.cancelMyBooking);
router.get("/export-pdf", bookingController.exportBookingPdf);

// ================= BOARDING CAGES =================
router.get("/boarding-cages", boardingCageController.getAllBoardingCages);
router.post("/boarding-cages", boardingCageController.createBoardingCage);
router.patch("/boarding-cages/:id", boardingCageController.updateCageStatus);
router.delete("/boarding-cages/:id", boardingCageController.deleteBoardingCage);
router.get(
  "/boarding-cages/available",
  boardingCageController.listAvailableCages
);

// ================= BOARDING BOOKINGS (HOTEL PET) =================
router.get(
  "/boarding-bookings",
  requireAuth,
  boardingBookingController.listMyBoardingBookings
);


router.post(
  "/boarding-bookings",
  requireAuth,
  boardingBookingController.createBoardingBooking
);

router.patch(
  "/boarding-bookings/:id/cancel",
  requireAuth,
  boardingBookingController.cancelBoardingBooking
);

// ================= PETS =================


export default router;
