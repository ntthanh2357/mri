import MedicalRecord from '../models/MedicalRecord.model';
import { MedicalRecord as MedicalRecordType } from '@neuroscan/types';

export const listMedicalRecords = async (): Promise<MedicalRecordType[]> => {
  const records = await MedicalRecord.find().lean();
  return records as unknown as MedicalRecordType[];
};

export const getMedicalRecordById = async (id: string): Promise<MedicalRecordType | null> => {
  const record = await MedicalRecord.findById(id).lean();
  return record as unknown as MedicalRecordType | null;
};

export const createMedicalRecord = async (data: Partial<MedicalRecordType>): Promise<MedicalRecordType> => {
  const record = new MedicalRecord(data);
  const savedRecord = await record.save();
  return savedRecord.toObject() as unknown as MedicalRecordType;
};

export const updateMedicalRecord = async (id: string, data: Partial<MedicalRecordType>): Promise<MedicalRecordType | null> => {
  const updatedRecord = await MedicalRecord.findByIdAndUpdate(id, data, { new: true }).lean();
  return updatedRecord as unknown as MedicalRecordType | null;
};

export const deleteMedicalRecord = async (id: string): Promise<boolean> => {
  const result = await MedicalRecord.findByIdAndDelete(id);
  return result !== null;
};
