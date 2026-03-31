import { Router } from "express";
import * as controller from "../../controllers/admin/boarding-booking.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

router.get("/hotel-staffs", controller.listBoardingHotelStaffs);
router.get("/busy-pets", controller.listBusyPetIdsForRange);
router.get("/", controller.listBoardingBookings);
router.get("/availability", controller.checkBoardingAvailability);
router.post("/batch-create", checkPermission("boarding_booking_create"), controller.batchCreateBoardingBooking);
router.post("/create", checkPermission("boarding_booking_create"), controller.createBoardingBooking);
router.get("/:id", controller.getBoardingBookingDetail);
router.put("/:id", controller.updateBoardingBookingDetail);
router.patch("/:id/status", controller.updateBoardingBookingStatus);
router.patch("/:id/payment-status", controller.updateBoardingPaymentStatus);
router.patch("/:id/care-schedule", controller.updateBoardingCareSchedule);

export default router;
