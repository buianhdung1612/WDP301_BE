import { Router } from "express";
import * as controller from "../../controllers/admin/boarding-booking.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/hotel-staffs", checkPermission("boarding_booking_view"), controller.listBoardingHotelStaffs);
router.get("/", checkPermission("boarding_booking_view"), controller.listBoardingBookings);
router.post("/create", checkPermission("boarding_booking_create"), controller.createBoardingBooking);
router.get("/:id", checkPermission("boarding_booking_view"), controller.getBoardingBookingDetail);
router.patch("/:id/status", checkPermission("boarding_booking_edit"), controller.updateBoardingBookingStatus);
router.patch("/:id/payment-status", checkPermission("boarding_booking_edit"), controller.updateBoardingPaymentStatus);
router.patch("/:id/care-schedule", checkPermission("boarding_booking_edit"), controller.updateBoardingCareSchedule);

export default router;
