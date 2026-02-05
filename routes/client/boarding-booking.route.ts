import * as boardingBookingController from "../../controllers/client/boarding-booking.controller";
import { Router } from "express";
import { requireAuth } from "../../middlewares/client/auth.middleware";
const router = Router();

router.use(requireAuth); // ⭐⭐⭐ BẮT BUỘC ⭐⭐

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
export default router;