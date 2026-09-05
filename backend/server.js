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

app.use(cors());
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

const VALID_LEVELS    = ["100L", "200L", "300L", "400L", "500L"];
const VALID_SEMESTERS = ["First Semester", "Second Semester"];

// =====================
// ADMIN MIDDLEWARE
// =====================
// Checks that the JWT has role: "admin"

const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "admin") {
            return res.status(403).json({ message: "Access denied: Admins only" });
        }

        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

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
// Detects admin by checking email + password against .env
// Returns role: "admin" or role: "student" in the JWT

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        // ✅ ADMIN CHECK — runs before student DB lookup
        if (
            email    === process.env.ADMIN_EMAIL &&
            password === process.env.ADMIN_PASSWORD
        ) {
            const token = jwt.sign(
                { role: "admin", email },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                message: "Admin login successful",
                token,
                role: "admin",
                user: {
                    fullname: "Administrator",
                    email
                }
            });
        }

        // ✅ STUDENT LOGIN — normal flow
        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: student._id, email: student.email, role: "student" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            role: "student",
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

    if (!studentEmail || !level || !semester || !courses || courses.length === 0) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (!VALID_LEVELS.includes(level)) {
        return res.status(400).json({ message: "Invalid level. Must be 100L–500L" });
    }

    if (!VALID_SEMESTERS.includes(semester)) {
        return res.status(400).json({ message: "Invalid semester" });
    }

    try {
        const existing = await Result.findOne({ studentEmail, level, semester });

        if (existing) {
            return res.status(400).json({
                message: `You already have a result for ${level} ${semester}. Delete it first to resubmit.`
            });
        }

        const convertedCourses = courses.map(course => ({
            course:     course.course,
            unit:       course.unit,
            gradePoint: gradeToPoint(course.grade)
        }));

        const totalWeightedPoints = convertedCourses.reduce(
            (sum, c) => sum + (c.gradePoint * c.unit), 0
        );
        const totalUnits = convertedCourses.reduce(
            (sum, c) => sum + c.unit, 0
        );

        if (totalUnits === 0) {
            return res.status(400).json({ message: "Total units cannot be zero" });
        }

        const gpa           = parseFloat((totalWeightedPoints / totalUnits).toFixed(2));
        const academicClass = gpaToClass(gpa);

        const result = new Result({
            studentEmail, level, semester,
            courses: convertedCourses,
            gpa, academicClass,
            date: new Date()
        });

        await result.save();

        const allResults = await Result.find({ studentEmail });
        const allCourses = allResults.flatMap(r => r.courses);

        const cumulativeWeighted = allCourses.reduce(
            (sum, c) => sum + (c.gradePoint * c.unit), 0
        );
        const cumulativeUnits = allCourses.reduce(
            (sum, c) => sum + c.unit, 0
        );

        const cgpa      = parseFloat((cumulativeWeighted / cumulativeUnits).toFixed(2));
        const cgpaClass = gpaToClass(cgpa);

        res.status(201).json({
            message: "Result saved successfully",
            result: { gpa, academicClass, totalUnits, level, semester, date: result.date, _id: result._id },
            cumulative: { cgpa, cgpaClass, totalSemesters: allResults.length, totalUnits: cumulativeUnits }
        });

    } catch (err) {
        console.log("SAVE RESULT ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// =====================
// GET RESULTS (student)
// =====================

app.get("/api/results/:email", auth, async (req, res) => {
    try {
        // Allow admin OR the student themselves
        if (req.user.role !== "admin" && req.user.email !== req.params.email) {
            return res.status(403).json({ message: "Access denied" });
        }

        const results = await Result.find({ studentEmail: req.params.email })
            .sort({ level: 1, semester: 1 });

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
        if (req.user.role !== "admin" && req.user.email !== req.params.email) {
            return res.status(403).json({ message: "Access denied" });
        }

        const allResults = await Result.find({ studentEmail: req.params.email });

        if (allResults.length === 0) {
            return res.status(200).json({
                cgpa: 0, cgpaClass: "No results yet",
                totalSemesters: 0, totalUnits: 0
            });
        }

        const allCourses         = allResults.flatMap(r => r.courses);
        const cumulativeWeighted = allCourses.reduce((sum, c) => sum + (c.gradePoint * c.unit), 0);
        const cumulativeUnits    = allCourses.reduce((sum, c) => sum + c.unit, 0);
        const cgpa               = parseFloat((cumulativeWeighted / cumulativeUnits).toFixed(2));
        const cgpaClass          = gpaToClass(cgpa);

        res.status(200).json({
            cgpa, cgpaClass,
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

        // Admin can delete any result; student can only delete their own
        if (req.user.role !== "admin" && result.studentEmail !== req.user.email) {
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

app.put("/api/profile", auth, async (req, res) => {
    const { fullname, matric } = req.body;

    if (!fullname || !matric) {
        return res.status(400).json({ message: "Fullname and matric are required" });
    }

    try {
        const existingMatric = await Student.findOne({
            matric,
            _id: { $ne: req.user.id }
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
            user: { fullname: student.fullname, matric: student.matric, email: student.email }
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

        const isMatch = await bcrypt.compare(oldPassword, student.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Old password is incorrect" });
        }

        student.password = await bcrypt.hash(newPassword, 10);
        await student.save();

        res.status(200).json({ message: "Password changed successfully" });

    } catch (err) {
        console.log("CHANGE PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ==========================
// ADMIN — GET ALL STUDENTS
// ==========================

app.get("/api/admin/students", adminAuth, async (req, res) => {
    try {
        const students = await Student.find().select("-password").sort({ createdAt: -1 });
        res.status(200).json(students);

    } catch (err) {
        console.log("ADMIN GET STUDENTS ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ==========================
// ADMIN — GET ALL RESULTS
// ==========================

app.get("/api/admin/results", adminAuth, async (req, res) => {
    try {
        const results = await Result.find().sort({ date: -1 });
        res.status(200).json(results);

    } catch (err) {
        console.log("ADMIN GET RESULTS ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ==========================
// ADMIN — DELETE A STUDENT
// ==========================
// Deletes the student account AND all their results

app.delete("/api/admin/students/:id", adminAuth, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Delete all results belonging to this student
        await Result.deleteMany({ studentEmail: student.email });

        // Delete the student account
        await student.deleteOne();

        res.status(200).json({
            message: `Student ${student.fullname} and all their results have been deleted.`
        });

    } catch (err) {
        console.log("ADMIN DELETE STUDENT ERROR:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ==========================
// ADMIN — DASHBOARD STATS
// ==========================

app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments();
        const totalResults  = await Result.countDocuments();

        // Count students per academic class
        const results    = await Result.find();
        const allStudentEmails = [...new Set(results.map(r => r.studentEmail))];

        // Calculate each student's CGPA and classify
        const classCounts = {
            "First Class":        0,
            "Second Class Upper": 0,
            "Second Class Lower": 0,
            "Third Class":        0,
            "Probation":          0
        };

        for (const email of allStudentEmails) {
            const studentResults = results.filter(r => r.studentEmail === email);
            const allCourses     = studentResults.flatMap(r => r.courses);

            if (allCourses.length === 0) continue;

            const weighted = allCourses.reduce((sum, c) => sum + (c.gradePoint * c.unit), 0);
            const units    = allCourses.reduce((sum, c) => sum + c.unit, 0);
            const cgpa     = weighted / units;
            const cls      = gpaToClass(cgpa);

            if (classCounts[cls] !== undefined) classCounts[cls]++;
        }

        res.status(200).json({
            totalStudents,
            totalResults,
            studentsWithResults: allStudentEmails.length,
            classCounts
        });

    } catch (err) {
        console.log("ADMIN STATS ERROR:", err.message);
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