// Định nghĩa cấu trúc data User
const createUser = ({ id, name, email, role = 'user' }) => ({
  id,
  name,
  email,
  role,
});

export default createUser;
