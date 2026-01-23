import express, { Router } from "express";
import * as serviceController from "../../controllers/client/service.controller";
import * as bookingController from "../../controllers/client/booking.controller";
import * as petController from "../../controllers/client/pet.controller";

const router = Router();

// Services
router.get("/services", serviceController.listServices);
router.get("/services/:id", serviceController.getService);
router.get("/service-categories", serviceController.getCategories);

// Bookings
router.get("/bookings", bookingController.listMyBookings);
router.get("/bookings/:id", bookingController.getMyBooking);
router.post("/bookings", bookingController.createBooking);
router.patch("/bookings/:id/cancel", bookingController.cancelMyBooking);

// Pets
router.get("/my-pets", petController.listMyPets);
router.get("/my-pets/:id", petController.getMyPet);
router.post("/my-pets", petController.createPet);
router.patch("/my-pets/:id", petController.updateMyPet);
router.delete("/my-pets/:id", petController.deleteMyPet);

export default router;
