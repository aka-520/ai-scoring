const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const router = express.Router();

router.get('/',                   authenticate, requireAdmin, ctrl.getAll);
router.get('/:id',                authenticate, requireAdmin, ctrl.getOne);
router.post('/',                  authenticate, requireAdmin, ctrl.create);
router.put('/:id',                authenticate, requireAdmin, ctrl.update);
router.post('/:id/reset-password', authenticate, requireAdmin, ctrl.resetPassword);
router.delete('/:id',             authenticate, requireAdmin, ctrl.remove);

module.exports = router;

