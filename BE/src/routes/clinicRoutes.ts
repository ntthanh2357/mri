import express from 'express';
import {
  createClinic,
  deleteClinic,
  getClinic,
  listClinics,
  updateClinic,
} from '../controllers/clinicController';

const router = express.Router();

router.get('/', listClinics);
router.get('/:id', getClinic);
router.post('/', createClinic);
router.put('/:id', updateClinic);
router.delete('/:id', deleteClinic);

export default router;
