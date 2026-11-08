const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../controllers/authController');
const {
    getAdminProducts,
    getAdminProduct,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/adminProductController');
const {
    getAdminCategories,
    getAdminCategory,
    createCategory,
    updateCategory,
    toggleCategoryVisibility,
    deleteCategory
} = require('../controllers/categoryController');

router.use(requireAuth, requireAdmin);
router.get('/categories', getAdminCategories);
router.post('/categories', createCategory);
router.get('/categories/:id', getAdminCategory);
router.put('/categories/:id', updateCategory);
router.patch('/categories/:id/visibility', toggleCategoryVisibility);
router.delete('/categories/:id', deleteCategory);
router.get('/', getAdminProducts);
router.post('/', createProduct);
router.get('/:id', getAdminProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
