const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
    course:     { type: String, required: true },  // e.g. "CSC 411"
    unit:       { type: Number, required: true },  // credit units (e.g. 3)
    gradePoint: { type: Number, required: true }   // converted grade point (0–5)
});

const resultSchema = new mongoose.Schema({
    studentEmail:  { type: String, required: true },
    level:         { type: String, required: true }, // e.g. "100L"
    semester:      { type: String, required: true }, // "First Semester" | "Second Semester"
    courses:       [courseSchema],
    gpa:           { type: Number, required: true }, // semester GPA
    academicClass: { type: String, required: true }, // e.g. "First Class"
    date:          { type: Date,   default: Date.now }
});

// Prevent duplicate semester entries per student
resultSchema.index(
    { studentEmail: 1, level: 1, semester: 1 },
    { unique: true }
);

module.exports = mongoose.model("Result", resultSchema);