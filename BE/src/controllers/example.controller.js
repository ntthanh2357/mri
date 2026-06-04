const ExampleService = require('../services/example.service');
const { success, error } = require('../utils/response.util');

const getAll = async (req, res, next) => {
  try {
    const data = await ExampleService.getAll();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await ExampleService.getById(req.params.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await ExampleService.create(req.body);
    return success(res, data, 'Created', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await ExampleService.update(req.params.id, req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await ExampleService.remove(req.params.id);
    return success(res, null, 'Deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
