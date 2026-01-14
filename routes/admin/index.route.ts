import { Router } from "express";
import articleRoutes from "./article.route"

const router = Router();

router.use('/article', articleRoutes);

export default router;