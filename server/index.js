const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');

const skillsRouter = require('./routes/skills'); 

const app = express();
const PORT = process.env.SERVER_PORT;
mongoose.connect('mongodb://localhost:27017').then(() => {
    console.log('MongoDB connected!')
}).catch(err => console.log(err));

app.use(express.json());

app.use('/skills', skillsRouter)

app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}!`);
});