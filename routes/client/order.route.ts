import { Router } from 'express';
const router: Router = Router();

import * as orderController from '../../controllers/client/order.controller';
import * as orderValidate from '../../validates/client/order.validate';
import { infoAuth } from '../../middlewares/client/auth.middleware';

router.post("/create", infoAuth, orderValidate.create, orderController.createPost);
router.get("/success", orderController.success);
router.get('/payment-zalopay', orderController.paymentZaloPay);
router.post('/payment-zalopay-result', orderController.paymentZalopayResult);
router.get('/payment-vnpay', orderController.paymentVNPay);
router.get('/payment-vnpay-result', orderController.paymentVNPayResult);
router.get('/export-pdf', orderController.exportPdf);

export const orderRoutes: Router = router;
