const express = require('express');

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        uniqueCaseInsensitive: true,
        trim: true,
        required: [true, 'Skill name is required'],
        collation:{ locale:"en", strength:2 }
    }
}, {
    timestamps: true
})

const model = mongoose.model('skills', schema);

module.exports = model;


