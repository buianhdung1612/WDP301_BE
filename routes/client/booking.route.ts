import { Router } from "express";
import * as serviceController from "../../controllers/client/service.controller";
import * as bookingController from "../../controllers/client/booking.controller";
import { infoAuth, requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

// ================= SERVICES =================
router.get("/services", serviceController.listServices);
router.get("/services/:id", serviceController.getService);
router.get("/service-categories", serviceController.getCategories);

// ================= SERVICE BOOKINGS =================
router.get("/bookings", requireAuth, bookingController.listMyBookings);
router.get("/bookings/:id", requireAuth, bookingController.getMyBooking);
router.patch("/bookings/:id/cancel", requireAuth, bookingController.cancelMyBooking);
router.post("/bookings", requireAuth, bookingController.createBooking);



export default router;
