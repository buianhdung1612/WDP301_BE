import { Router } from "express";
import * as serviceController from "../../controllers/client/service.controller";
import * as bookingController from "../../controllers/client/booking.controller";
import * as petController from "../../controllers/client/pet.controller";
import * as boardingCageController from "../../controllers/client/boarding-cage.controller";
import * as boardingBookingController from "../../controllers/client/boarding-booking.controller";

const router = Router();

// ================= SERVICES =================
router.get("/services", serviceController.listServices);
router.get("/services/:id", serviceController.getService);
router.get("/service-categories", serviceController.getCategories);

// ================= SERVICE BOOKINGS =================
router.get("/time-slots", bookingController.getAvailableTimeSlots);
router.get("/bookings", bookingController.listMyBookings);
router.get("/bookings/:id", bookingController.getMyBooking);
router.post("/bookings", bookingController.createBooking);
router.patch("/bookings/:id/cancel", bookingController.cancelMyBooking);

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
  boardingBookingController.listMyBoardingBookings
);


router.post(
  "/boarding-bookings",
  boardingBookingController.createBoardingBooking
);

router.patch(
  "/boarding-bookings/:id/cancel",
  boardingBookingController.cancelBoardingBooking
);

// ================= PETS =================


export default router;
