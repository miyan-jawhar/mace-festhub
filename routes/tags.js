// routes/tags.js — Tag and theme management routes
const express = require('express');
const router  = express.Router();
const { getAllTags, createTag } = require('../controllers/tagController');
const { requireAuth } = require('../middleware/auth');

router.get('/',  getAllTags);  // GET  /api/tags (public)
router.post('/', createTag);   // POST /api/tags (public/authenticated)

module.exports = router;
