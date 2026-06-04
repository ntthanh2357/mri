const ExampleModel = require('../models/example.model');

const getAll = async () => {
  return await ExampleModel.findAll();
};

const getById = async (id) => {
  return await ExampleModel.findById(id);
};

const create = async (data) => {
  return await ExampleModel.create(data);
};

const update = async (id, data) => {
  return await ExampleModel.update(id, data);
};

const remove = async (id) => {
  return await ExampleModel.delete(id);
};

module.exports = { getAll, getById, create, update, remove };
