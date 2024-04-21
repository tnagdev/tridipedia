const express = require('express');

const {getSkillsHandler, addSkillHandler} = require('../controllers/skills')

const router = express.Router();

router.route('/').get(getSkillsHandler).post(addSkillHandler)


module.exports = router;