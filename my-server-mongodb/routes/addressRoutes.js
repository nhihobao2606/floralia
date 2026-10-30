const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');
const {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} = require('../controllers/addressController');

router.use(requireAuth);

router.get('/', getAddresses);
router.post('/', addAddress);
router.put('/:id/default', setDefaultAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
