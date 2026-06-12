import User from '../models/User.model';
import { User as UserType } from '@neuroscan/types';

export const listUsers = async (): Promise<UserType[]> => {
  const users = await User.find().lean();
  return users as unknown as UserType[];
};

export const getUserById = async (id: string): Promise<UserType | null> => {
  const user = await User.findById(id).lean();
  return user as unknown as UserType | null;
};

export const createUser = async (data: Partial<UserType>): Promise<UserType> => {
  const user = new User(data);
  const savedUser = await user.save();
  return savedUser.toObject() as unknown as UserType;
};

export const updateUser = async (id: string, data: Partial<UserType>): Promise<UserType | null> => {
  const updatedUser = await User.findByIdAndUpdate(id, data, { new: true }).lean();
  return updatedUser as unknown as UserType | null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  const result = await User.findByIdAndDelete(id);
  return result !== null;
};
