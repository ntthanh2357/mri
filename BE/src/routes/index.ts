import express from 'express';
import userRoutes from './userRoutes';
import clinicRoutes from './clinicRoutes';
import medicalRecordRoutes from './medicalRecordRoutes';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/clinics', clinicRoutes);
router.use('/medical-records', medicalRecordRoutes);

export default router;
