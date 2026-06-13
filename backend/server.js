console.log("🔥 SERVER FILE IS RUNNING (NEW VERSION)");
require("dotenv").config({ path: "./.env" });

const bcrypt   = require("bcryptjs");
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const jwt      = require("jsonwebtoken");
const auth     = require("./middleware/auth");

const Student = require("./models/Student");
const Result  = require("./models/Result");

const app = express();

// =====================
// MIDDLEWARE
// =====================

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://astre117.github.io"
    ]
}));
app.use(express.json());

// =====================
// CONNECT MONGODB
// =====================

console.log("PORT =", process.env.PORT);
console.log("MONGO_URI =", process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.log("❌ MongoDB Error:", err));

// =====================
// HELPERS
// =====================

const gradeToPoint = (grade) => {
    switch (grade.toUpperCase()) {
        case "A": return 5;
        case "B": return 4;
        case "C": return 3;
        case "D": return 2;
        case "E": return 1;
        case "F": return 0;
        default:  return 0;
    }
};

const gpaToClass = (gpa) => {
    if (gpa >= 4.50) return "First Class";
    if (gpa >= 3.50) return "Second Class Upper";
    if (gpa >= 2.40) return "Second Class Lower";
    if (gpa >= 1.50) return "Third Class";
    return "Probation";
};

// Valid levels and semesters
const VALID_LEVELS    = ["100L", "200L", "300L", "400L", "500L"];
const VALID_SEMESTERS = ["First Semester", "Second Semester"];

// =====================
// ROUTES
// =====================

app.get("/", (req, res) => {
    res.json({ message: "✅ CGPA Calculator Backend Running" });
});

// =====================
// REGISTER
// =====================

app.post("/api/register", async (req, res) => {
    const { fullname, matric, email, password } = req.body;

    if (!fullname || !matric || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const existingUser = await Student.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const student = new Student({ fullname, matric, email, password: hashedPassword });
        await student.save();

        res.status(201).json({
            message: "Account created successfully",
            user: { fullname, matric, email }
        });

    } catch (err) {
        console.log("REGISTER ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// LOGIN
// =====================

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: student._id, email: student.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                fullname: student.fullname,
                matric:   student.matric,
                email:    student.email
            }
        });

    } catch (err) {
        console.log("LOGIN ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// SAVE RESULT
// =====================

app.post("/api/save-result", auth, async (req, res) => {
    const { studentEmail, level, semester, courses } = req.body;

    // Validate all fields present
    if (!studentEmail || !level || !semester || !courses || courses.length === 0) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Validate level and semester values
    if (!VALID_LEVELS.includes(level)) {
        return res.status(400).json({ message: "Invalid level. Must be 100L–500L" });
    }

    if (!VALID_SEMESTERS.includes(semester)) {
        return res.status(400).json({ message: "Invalid semester" });
    }

    try {
        // ✅ Duplicate check — block same level + semester submission
        const existing = await Result.findOne({ studentEmail, level, semester });

        if (existing) {
            return res.status(400).json({
                message: `You already have a result for ${level} ${semester}. Delete it first to resubmit.`
            });
        }

        // Convert grades and attach units
        const convertedCourses = courses.map(course => ({
            course:     course.course,
            unit:       course.unit,
            gradePoint: gradeToPoint(course.grade)
        }));

        // Weighted semester GPA
        const totalWeightedPoints = convertedCourses.reduce(
            (sum, c) => sum + (c.gradePoint * c.unit), 0
        );
        const totalUnits = convertedCourses.reduce(
            (sum, c) => sum + c.unit, 0
        );

        if (totalUnits === 0) {
            return res.status(400).json({ message: "Total units cannot be zero" });
        }

        const gpa          = parseFloat((totalWeightedPoints / totalUnits).toFixed(2));
        const academicClass = gpaToClass(gpa);

        const result = new Result({
            studentEmail,
            level,
            semester,
            courses: convertedCourses,
            gpa,
            academicClass,
            date: new Date()
        });

        await result.save();

        // ✅ Recalculate cumulative CGPA across ALL semesters
        const allResults = await Result.find({ studentEmail });

        const allCourses = allResults.flatMap(r => r.courses);

        const cumulativeWeighted = allCourses.reduce(
            (sum, c) => sum + (c.gradePoint * c.unit), 0
        );
        const cumulativeUnits = allCourses.reduce(
            (sum, c) => sum + c.unit, 0
        );

        const cgpa          = parseFloat((cumulativeWeighted / cumulativeUnits).toFixed(2));
        const cgpaClass     = gpaToClass(cgpa);

        res.status(201).json({
            message: "Result saved successfully",
            result: {
                gpa,
                academicClass,
                totalUnits,
                level,
                semester,
                date: result.date,
                _id:  result._id
            },
            cumulative: {
                cgpa,
                cgpaClass,
                totalSemesters: allResults.length,
                totalUnits:     cumulativeUnits
            }
        });

    } catch (err) {
        console.log("SAVE RESULT ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// GET ALL RESULTS
// =====================

app.get("/api/results/:email", auth, async (req, res) => {
    try {
        if (req.user.email !== req.params.email) {
            return res.status(403).json({ message: "Access denied" });
        }

        const results = await Result.find({ studentEmail: req.params.email })
            .sort({ level: 1, semester: 1 }); // sort by level then semester

        res.status(200).json(results);

    } catch (err) {
        console.log("GET RESULTS ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// GET CUMULATIVE CGPA
// =====================

app.get("/api/cgpa/:email", auth, async (req, res) => {
    try {
        if (req.user.email !== req.params.email) {
            return res.status(403).json({ message: "Access denied" });
        }

        const allResults = await Result.find({ studentEmail: req.params.email });

        if (allResults.length === 0) {
            return res.status(200).json({
                cgpa:           0,
                cgpaClass:      "No results yet",
                totalSemesters: 0,
                totalUnits:     0
            });
        }

        const allCourses = allResults.flatMap(r => r.courses);

        const cumulativeWeighted = allCourses.reduce(
            (sum, c) => sum + (c.gradePoint * c.unit), 0
        );
        const cumulativeUnits = allCourses.reduce(
            (sum, c) => sum + c.unit, 0
        );

        const cgpa      = parseFloat((cumulativeWeighted / cumulativeUnits).toFixed(2));
        const cgpaClass = gpaToClass(cgpa);

        res.status(200).json({
            cgpa,
            cgpaClass,
            totalSemesters: allResults.length,
            totalUnits:     cumulativeUnits
        });

    } catch (err) {
        console.log("GET CGPA ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// DELETE A RESULT
// =====================

app.delete("/api/results/:id", auth, async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);

        if (!result) {
            return res.status(404).json({ message: "Result not found" });
        }

        if (result.studentEmail !== req.user.email) {
            return res.status(403).json({ message: "Access denied" });
        }

        await result.deleteOne();

        res.status(200).json({ message: "Result deleted successfully" });

    } catch (err) {
        console.log("DELETE RESULT ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// GET PROFILE
// =====================

app.get("/api/profile", auth, async (req, res) => {
    try {
        const student = await Student.findById(req.user.id).select("-password");

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.status(200).json({
            fullname: student.fullname,
            matric:   student.matric,
            email:    student.email
        });

    } catch (err) {
        console.log("GET PROFILE ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// UPDATE PROFILE
// =====================
// Updates fullname and matric only — email is locked

app.put("/api/profile", auth, async (req, res) => {
    const { fullname, matric } = req.body;

    if (!fullname || !matric) {
        return res.status(400).json({ message: "Fullname and matric are required" });
    }

    try {
        // Check if new matric is already taken by another student
        const existingMatric = await Student.findOne({
            matric,
            _id: { $ne: req.user.id } // exclude current user
        });

        if (existingMatric) {
            return res.status(400).json({ message: "Matric number already in use" });
        }

        const student = await Student.findByIdAndUpdate(
            req.user.id,
            { fullname, matric },
            { new: true, select: "-password" }
        );

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                fullname: student.fullname,
                matric:   student.matric,
                email:    student.email
            }
        });

    } catch (err) {
        console.log("UPDATE PROFILE ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// CHANGE PASSWORD
// =====================

app.put("/api/profile/password", auth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: "Old and new passwords are required" });
    }

    if (newPassword.length < 5) {
        return res.status(400).json({ message: "New password must be at least 5 characters" });
    }

    try {
        const student = await Student.findById(req.user.id);

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, student.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Old password is incorrect" });
        }

        // Hash and save new password
        student.password = await bcrypt.hash(newPassword, 10);
        await student.save();

        res.status(200).json({ message: "Password changed successfully" });

    } catch (err) {
        console.log("CHANGE PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// FORGOT PASSWORD
// =====================

const nodemailer = require("nodemailer");
const crypto     = require("crypto");

const resetTokens = {};

app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(404).json({ message: "No account found with that email" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        resetTokens[token] = { email, expires: Date.now() + 3600000 };

        const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

        const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "CGPA Portal — Password Reset",
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password. This link expires in 1 hour.</p>
                <a href="${resetLink}">Reset My Password</a>
                <p>If you didn't request this, ignore this email.</p>
            `
        });

        res.status(200).json({ message: "Reset link sent to your email" });

    } catch (err) {
        console.log("FORGOT PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// RESET PASSWORD
// =====================

app.post("/api/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    const record = resetTokens[token];

    if (!record || Date.now() > record.expires) {
        return res.status(400).json({ message: "Reset link is invalid or expired" });
    }

    if (!newPassword || newPassword.length < 5) {
        return res.status(400).json({ message: "Password must be at least 5 characters" });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await Student.findOneAndUpdate(
            { email: record.email },
            { password: hashedPassword }
        );

        delete resetTokens[token];

        res.status(200).json({ message: "Password reset successfully" });

    } catch (err) {
        console.log("RESET PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});
// =====================
// START SERVER
// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});