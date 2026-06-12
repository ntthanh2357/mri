import { Request, Response } from 'express';
import * as userService from '../services/userService';

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  const users = await userService.listUsers();
  res.json(users);
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(user);
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const updatedUser = await userService.updateUser(req.params.id, req.body);
  if (!updatedUser) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(updatedUser);
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const deleted = await userService.deleteUser(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.status(204).send();
};
