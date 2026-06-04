const express = require('express');
const router = express.Router();

const exampleRoutes = require('./example.routes');

router.get('/', (req, res) => {
  res.json({ success: true, message: 'MRI API v1' });
});

router.use('/examples', exampleRoutes);

module.exports = router;
