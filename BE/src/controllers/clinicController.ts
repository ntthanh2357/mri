import { Request, Response } from 'express';
import * as clinicService from '../services/clinicService';

export const listClinics = async (req: Request, res: Response): Promise<void> => {
  const clinics = await clinicService.listClinics();
  res.json(clinics);
};

export const getClinic = async (req: Request, res: Response): Promise<void> => {
  const clinic = await clinicService.getClinicById(req.params.id);
  if (!clinic) {
    res.status(404).json({ message: 'Clinic not found' });
    return;
  }
  res.json(clinic);
};

export const createClinic = async (req: Request, res: Response): Promise<void> => {
  const clinic = await clinicService.createClinic(req.body);
  res.status(201).json(clinic);
};

export const updateClinic = async (req: Request, res: Response): Promise<void> => {
  const updatedClinic = await clinicService.updateClinic(req.params.id, req.body);
  if (!updatedClinic) {
    res.status(404).json({ message: 'Clinic not found' });
    return;
  }
  res.json(updatedClinic);
};

export const deleteClinic = async (req: Request, res: Response): Promise<void> => {
  const deleted = await clinicService.deleteClinic(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: 'Clinic not found' });
    return;
  }
  res.status(204).send();
};
