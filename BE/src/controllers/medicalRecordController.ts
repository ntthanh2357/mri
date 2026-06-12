import { Request, Response } from 'express';
import * as medicalRecordService from '../services/medicalRecordService';

export const listMedicalRecords = async (req: Request, res: Response): Promise<void> => {
  const records = await medicalRecordService.listMedicalRecords();
  res.json(records);
};

export const getMedicalRecord = async (req: Request, res: Response): Promise<void> => {
  const record = await medicalRecordService.getMedicalRecordById(req.params.id);
  if (!record) {
    res.status(404).json({ message: 'Medical record not found' });
    return;
  }
  res.json(record);
};

export const createMedicalRecord = async (req: Request, res: Response): Promise<void> => {
  const record = await medicalRecordService.createMedicalRecord(req.body);
  res.status(201).json(record);
};

export const updateMedicalRecord = async (req: Request, res: Response): Promise<void> => {
  const updatedRecord = await medicalRecordService.updateMedicalRecord(req.params.id, req.body);
  if (!updatedRecord) {
    res.status(404).json({ message: 'Medical record not found' });
    return;
  }
  res.json(updatedRecord);
};

export const deleteMedicalRecord = async (req: Request, res: Response): Promise<void> => {
  const deleted = await medicalRecordService.deleteMedicalRecord(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: 'Medical record not found' });
    return;
  }
  res.status(204).send();
};
