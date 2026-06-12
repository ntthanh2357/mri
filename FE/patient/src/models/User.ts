import { User as AuthUser } from '@neuroscan/auth';

export interface User extends AuthUser {}

export const createUser = ({ id, name, email, role = 'patient' }: Omit<User, 'role'> & { role?: User['role'] }): User => ({
  id,
  name,
  email,
  role,
});
