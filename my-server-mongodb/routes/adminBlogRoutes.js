const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin } = require('../controllers/authController');
const {
    getAdminBlogs,
    getCategories,
    getAuthors,
    getAdminBlog,
    createBlog,
    updateBlog,
    deleteBlog
} = require('../controllers/adminBlogController');

router.use(requireAuth, requireAdmin);
router.get('/', getAdminBlogs);
router.get('/categories', getCategories);
router.get('/authors', getAuthors);
router.post('/', createBlog);
router.get('/:id', getAdminBlog);
router.put('/:id', updateBlog);
router.delete('/:id', deleteBlog);

module.exports = router;
