import { Router } from "express";
import * as bookingController from "../../controllers/admin/booking.controller";
import * as petController from "../../controllers/admin/pet.controller";
import * as timeSlotController from "../../controllers/admin/time-slot.controller";

const router = Router();

// Bookings
router.get("/bookings", bookingController.listBookings);
router.get("/bookings/:id", bookingController.getBooking);
router.patch("/bookings/:id/confirm", bookingController.confirmBooking);
router.patch("/bookings/:id/cancel", bookingController.cancelBooking);
router.patch("/bookings/:id/complete", bookingController.completeBooking);
router.patch("/bookings/:id/assign-staff", bookingController.assignStaff);

// Pets
router.get("/pets", petController.listPets);
router.get("/pets/:id", petController.getPet);
router.patch("/pets/:id", petController.updatePet);
router.delete("/pets/:id", petController.deletePet);

// Time Slots
router.get("/time-slots", timeSlotController.listTimeSlots);
router.post("/time-slots", timeSlotController.createTimeSlot);
router.patch("/time-slots/:id", timeSlotController.updateTimeSlot);
router.delete("/time-slots/:id", timeSlotController.deleteTimeSlot);

export default router;
