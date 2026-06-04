const express = require('express');
const router = express.Router();
const ExampleController = require('../controllers/example.controller');

router.get('/', ExampleController.getAll);
router.get('/:id', ExampleController.getById);
router.post('/', ExampleController.create);
router.put('/:id', ExampleController.update);
router.delete('/:id', ExampleController.remove);

module.exports = router;
