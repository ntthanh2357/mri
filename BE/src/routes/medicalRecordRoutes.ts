import express from 'express';
import {
  createMedicalRecord,
  deleteMedicalRecord,
  getMedicalRecord,
  listMedicalRecords,
  updateMedicalRecord,
} from '../controllers/medicalRecordController';

const router = express.Router();

router.get('/', listMedicalRecords);
router.get('/:id', getMedicalRecord);
router.post('/', createMedicalRecord);
router.put('/:id', updateMedicalRecord);
router.delete('/:id', deleteMedicalRecord);

export default router;
