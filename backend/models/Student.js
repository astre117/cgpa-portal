const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    matric:   { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Student", studentSchema);