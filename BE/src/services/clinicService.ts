import Clinic from '../models/Clinic.model';
import { Clinic as ClinicType } from '@neuroscan/types';

export const listClinics = async (): Promise<ClinicType[]> => {
  const clinics = await Clinic.find().lean();
  return clinics as unknown as ClinicType[];
};

export const getClinicById = async (id: string): Promise<ClinicType | null> => {
  const clinic = await Clinic.findById(id).lean();
  return clinic as unknown as ClinicType | null;
};

export const createClinic = async (data: Partial<ClinicType>): Promise<ClinicType> => {
  const clinic = new Clinic(data);
  const savedClinic = await clinic.save();
  return savedClinic.toObject() as unknown as ClinicType;
};

export const updateClinic = async (id: string, data: Partial<ClinicType>): Promise<ClinicType | null> => {
  const updatedClinic = await Clinic.findByIdAndUpdate(id, data, { new: true }).lean();
  return updatedClinic as unknown as ClinicType | null;
};

export const deleteClinic = async (id: string): Promise<boolean> => {
  const result = await Clinic.findByIdAndDelete(id);
  return result !== null;
};
