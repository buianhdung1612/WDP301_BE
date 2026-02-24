import express from 'express';
import * as seedController from '../../controllers/admin/seed.controller';

const router = express.Router();

// POST /api/v1/admin/seed/roles-and-staff
router.post('/roles-and-staff', seedController.seedRolesAndStaff);

// POST /api/v1/admin/seed/breeds
router.post('/breeds', seedController.seedBreeds);

export default router;
