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
// ================= SERVICE BOOKINGS =================
router.get("/time-slots", bookingController.getAvailableTimeSlots); // Thường ko cần auth để xem slot
router.get("/bookings", requireAuth, bookingController.listMyBookings);
router.get("/bookings/:id", requireAuth, bookingController.getMyBooking);
router.post("/bookings", infoAuth, bookingController.createBooking); // infoAuth để hỗ trợ cả guest và user
router.patch("/bookings/:id/cancel", requireAuth, bookingController.cancelMyBooking);
router.get("/export-pdf", bookingController.exportBookingPdf);


export default router;
