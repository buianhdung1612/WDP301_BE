import * as boardingBookingController from "../../controllers/client/boarding-booking.controller";
import { Router } from "express";
import { requireAuth } from "../../middlewares/client/auth.middleware";

const router = Router();

router.post(
  "/payment-zalopay-result",
  boardingBookingController.paymentBoardingZalopayResult
);
router.get(
  "/payment-vnpay-result",
  boardingBookingController.paymentBoardingVNPayResult
);

router.use(requireAuth);

router.get("/boarding-bookings", boardingBookingController.listMyBoardingBookings);
router.get("/boarding-bookings/:id", boardingBookingController.getMyBoardingBookingDetail);
router.post("/boarding-bookings", boardingBookingController.createBoardingBooking);
router.post("/boarding-bookings/:id/pay", boardingBookingController.initiateBoardingPayment);
router.patch("/boarding-bookings/:id/cancel", boardingBookingController.cancelBoardingBooking);

export default router;
