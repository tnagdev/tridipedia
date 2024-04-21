const mongoose = require('mongoose');
const Skills = require('./../models/skills');

const getSkillsHandler = async (req, res) => {
    const data = await Skills.find({});
    return res.status(200).json({success: true, data})
} 

const addSkillHandler = async (req, res) => {
    const body = req.body;
    try {
        const data = await Skills.create({
            name: body.name
        });
        return res.status(200).json({success: true, data})
    } catch (error) {
        if (error.name === "ValidationError") {
            let errors = {};
            Object.keys(error.errors).forEach((key) => {
              errors[key] = error.errors[key].message;
            });
            return res.status(400).json(errors);
        }
        if (error.code === 11000) {
            return res.status(400).json({error: `Skill '${body.name}' already exists`})
        }
        return res.status(400).json({error: 'Failed to create skill'});
    }
}

const updateSkillHandler = async (req, res) => {
    
}


module.exports = {
    getSkillsHandler, addSkillHandler
}