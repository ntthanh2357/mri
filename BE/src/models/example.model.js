// Ví dụ model — thay bằng Mongoose/Sequelize/Prisma tuỳ DB
const ExampleModel = {
  findAll: async () => {
    return [];
  },
  findById: async (id) => {
    return { id };
  },
  create: async (data) => {
    return { id: Date.now(), ...data };
  },
  update: async (id, data) => {
    return { id, ...data };
  },
  delete: async (id) => {
    return { id };
  },
};

module.exports = ExampleModel;
