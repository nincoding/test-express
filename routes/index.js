const express = require('express');
const router = express.Router();
const testController = require('../controller/tt');

router.post('/auth/signup', testController.signup);
router.post('/auth/login', testController.login);
router.get('/', testController.getProfile);

module.exports = router;