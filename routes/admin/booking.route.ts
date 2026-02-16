import { Router } from "express";
import * as bookingController from "../../controllers/admin/booking.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

// Bookings
router.get("/bookings", checkPermission("booking_view"), bookingController.listBookings);
router.get("/bookings/staff-tasks", checkPermission("booking_view"), bookingController.listStaffTasks);
router.get("/bookings/staff-detail/:id", checkPermission("booking_view"), bookingController.getStaffBookingDetail);
router.get("/bookings/available-slots", checkPermission("booking_view"), bookingController.getAvailableSlots);
router.get("/bookings/export-staff-schedule", checkPermission("booking_export"), bookingController.exportDailyStaffSchedule);
router.get("/bookings/:id", checkPermission("booking_view"), bookingController.getBooking);
router.post("/bookings/create", checkPermission("booking_create"), bookingController.createBooking);
router.patch("/bookings/:id/confirm", checkPermission("booking_edit"), bookingController.confirmBooking);
router.patch("/bookings/:id/cancel", checkPermission("booking_edit"), bookingController.cancelBooking);
router.patch("/bookings/:id/complete", checkPermission("booking_edit"), bookingController.completeBooking);
router.patch("/bookings/:id/start", checkPermission("booking_edit"), bookingController.startInProgress);
router.patch("/bookings/:id/reschedule", checkPermission("booking_edit"), bookingController.rescheduleBooking);
router.patch("/bookings/:id/update", checkPermission("booking_edit"), bookingController.updateBooking);
router.patch("/bookings/:id/assign-staff", checkPermission("booking_assign"), bookingController.assignStaff);
router.get("/bookings/:id/recommend-staff", checkPermission("booking_assign"), bookingController.getRecommendedStaff);

export default router;
