const express = require("express");
const router = express.Router();

const {
    getBlogs,
    getBlogByIdentifier
} = require("../controllers/blogController");

router.get("/", getBlogs);
router.get("/:identifier", getBlogByIdentifier);

module.exports = router;
