// import { Router } from "express";
// import * as controller from "../../controllers/admin/setting.controller";
// import { checkPermission } from "../../middlewares/admin/auth.middleware";

// const router: Router = Router();

// router.get("/general", checkPermission("settings_view"), controller.getGeneral);
// router.patch("/general", checkPermission("settings_edit"), controller.updateGeneral);

// export const settingRoutes: Router = router;
import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";

const router = Router();

router.get('/api-shipping', settingController.apiShipping);

router.patch('/api-shipping', settingController.apiShippingPatch);

router.get('/api-payment', settingController.apiPayment);

router.patch('/api-payment', settingController.apiPaymentPatch);

router.get('/api-login-social', settingController.apiLoginSocial);

router.patch('/api-login-social', settingController.apiLoginSocialPatch);

router.get('/api-app-password', settingController.apiAppPassword);

router.patch('/api-app-password', settingController.apiAppPasswordPatch);

router.get('/general', settingController.general);

router.patch('/general', settingController.generalPatch);

export default router;
