import express, { Router } from "express";
import * as serviceController from "../../controllers/admin/service.controller";
import * as serviceCategoryController from "../../controllers/admin/service-category.controller";
import * as bookingController from "../../controllers/admin/booking.controller";
import * as petController from "../../controllers/admin/pet.controller";
import * as timeSlotController from "../../controllers/admin/time-slot.controller";

const router = Router();

// Service Categories
router.get("/service-categories", serviceCategoryController.listCategories);
router.get("/service-categories/:id", serviceCategoryController.getCategory);
router.post("/service-categories", serviceCategoryController.createCategory);
router.patch("/service-categories/:id", serviceCategoryController.updateCategory);
router.delete("/service-categories/:id", serviceCategoryController.deleteCategory);

// Services
router.get("/services", serviceController.listServices);
router.get("/services/:id", serviceController.getService);
router.post("/services", serviceController.createService);
router.patch("/services/:id", serviceController.updateService);
router.delete("/services/:id", serviceController.deleteService);

// Bookings
router.get("/bookings", bookingController.listBookings);
router.get("/bookings/:id", bookingController.getBooking);
router.patch("/bookings/:id/confirm", bookingController.confirmBooking);
router.patch("/bookings/:id/cancel", bookingController.cancelBooking);
router.patch("/bookings/:id/complete", bookingController.completeBooking);

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
