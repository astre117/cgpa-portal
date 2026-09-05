// =====================
// CUSTOM ALERT
// =====================

function showAlert(message, type = "info", title = null) {
    const icons     = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
    const titles    = { success: "Success", error: "Error", warning: "Warning", info: "Notice" };
    const btnClasses = { success: "success", error: "danger", warning: "", info: "" };

    document.getElementById("alertIcon").textContent    = icons[type];
    document.getElementById("alertTitle").textContent   = title || titles[type];
    document.getElementById("alertMessage").textContent = message;

    const btn     = document.getElementById("alertBtn");
    btn.className = "alert-btn " + (btnClasses[type] || "");

    document.getElementById("customAlert").classList.add("show");
}

function closeAlert() {
    document.getElementById("customAlert").classList.remove("show");
}

// =====================
// BASE URL
// =====================

const BASE_URL = "http://localhost:3000";

// =====================
// SESSION HELPERS
// =====================

function getToken() {
    return localStorage.getItem("token");
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
}

function checkSession() {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
        localStorage.clear();
        if (protectedPages.includes(currentPage)) {
            window.location.href = "index.html";
        }
        return false;
    }
    return true;
}

// =====================
// SESSION PROTECTION
// =====================

const protectedPages = ["dashboard.html", "calculator.html", "results.html", "profile.html", "admin-dashboard.html"];
const currentPage    = window.location.pathname.split("/").pop();

if (protectedPages.includes(currentPage)) {
    checkSession();

    // ✅ Block students from accessing admin page
    if (currentPage === "admin-dashboard.html" && localStorage.getItem("role") !== "admin") {
        window.location.href = "index.html";
    }

    // ✅ Block admin from accessing student pages
    const studentOnlyPages = ["dashboard.html", "calculator.html", "results.html", "profile.html"];
    if (studentOnlyPages.includes(currentPage) && localStorage.getItem("role") === "admin") {
        window.location.href = "admin-dashboard.html";
    }
}

// =====================
// AUTH TOGGLE
// =====================

const signupForm    = document.getElementById("signupForm");
const loginForm     = document.getElementById("loginForm");
const toggleForm    = document.getElementById("toggleForm");
const formTitle     = document.getElementById("formTitle");
const formSubtitle  = document.getElementById("formSubtitle");
const toggleMessage = document.getElementById("toggleMessage");

let isLoginMode = false;

if (toggleForm) {
    toggleForm.addEventListener("click", function (e) {
        e.preventDefault();
        isLoginMode = !isLoginMode;

        if (isLoginMode) {
            signupForm.style.display  = "none";
            loginForm.style.display   = "block";
            formTitle.textContent     = "Welcome Back";
            formSubtitle.textContent  = "Login to continue to your dashboard";
            toggleMessage.textContent = "Don't have an account?";
            toggleForm.textContent    = "Create Account";
        } else {
            loginForm.style.display   = "none";
            signupForm.style.display  = "block";
            formTitle.textContent     = "Create Account";
            formSubtitle.textContent  = "Create your account to access the CGPA portal";
            toggleMessage.textContent = "Already have an account?";
            toggleForm.textContent    = "Login";
        }
    });
}

// =====================
// SIGN UP
// =====================

if (signupForm) {
    signupForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const fullname        = document.getElementById("fullname").value.trim();
        const matric          = document.getElementById("matric").value.trim();
        const email           = document.getElementById("signupEmail").value.trim();
        const password        = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            showAlert("Passwords do not match!", "error");
            return;
        }

        try {
            const res  = await fetch(`${BASE_URL}/api/register`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ fullname, matric, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                showAlert("Account created successfully! Please log in.", "success");
                signupForm.style.display = "none";
                loginForm.style.display  = "block";
                isLoginMode = true;
            } else {
                showAlert(data.message || "Registration failed", "error");
            }

        } catch (error) {
            showAlert("Server error. Please try again.", "error");
            console.error(error);
        }
    });
}

// =====================
// LOGIN
// =====================

if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email    = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const res  = await fetch(`${BASE_URL}/api/login`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // Save token, user, and role
                localStorage.setItem("token", data.token);
                localStorage.setItem("user",  JSON.stringify(data.user));
                localStorage.setItem("role",  data.role);

                showAlert("Login successful!", "success");

                setTimeout(() => {
                    // ✅ Admin goes to admin dashboard; students go to their dashboard
                    if (data.role === "admin") {
                        window.location.href = "admin-dashboard.html";
                    } else {
                        window.location.href = "dashboard.html";
                    }
                }, 1000);

            } else {
                showAlert(data.message || "Login failed", "error");
            }

        } catch (err) {
            console.error(err);
            showAlert("Server error. Try again.", "error");
        }
    });
}

// =====================
// SHOW/HIDE PASSWORD
// =====================

const showSignupPassword = document.getElementById("showSignupPassword");
if (showSignupPassword) {
    showSignupPassword.addEventListener("change", function () {
        const pw  = document.getElementById("signupPassword");
        const cpw = document.getElementById("confirmPassword");
        pw.type   = this.checked ? "text" : "password";
        cpw.type  = this.checked ? "text" : "password";
    });
}

const showLoginPassword = document.getElementById("showLoginPassword");
if (showLoginPassword) {
    showLoginPassword.addEventListener("change", function () {
        const pw = document.getElementById("loginPassword");
        pw.type  = this.checked ? "text" : "password";
    });
}

// =====================
// WELCOME & STUDENT INFO
// =====================

const welcomeMessage = document.getElementById("welcomeMessage");
const savedUser      = getUser();

if (welcomeMessage && savedUser) {
    welcomeMessage.textContent = "Welcome, " + savedUser.fullname;
}

const studentName   = document.getElementById("studentName");
const studentMatric = document.getElementById("studentMatric");

if (savedUser) {
    if (studentName)   studentName.textContent   = "Name: "          + savedUser.fullname;
    if (studentMatric) studentMatric.textContent = "Matric Number: " + savedUser.matric;
}

// =====================
// LIVE DATE & TIME
// =====================

const liveDateTimeElement = document.getElementById("liveDateTime");
if (liveDateTimeElement) {
    function updateDateTime() {
        liveDateTimeElement.textContent = new Date().toLocaleString();
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// ===========================
// CGPA CALCULATOR
// ===========================

let courses = [];

function addCourse() {
    const courseCodeInput = document.getElementById("courseCode");
    const courseUnitInput = document.getElementById("courseUnit");
    const gradeInput      = document.getElementById("grade");

    const courseCode = courseCodeInput.value.trim();
    const courseUnit = parseInt(courseUnitInput.value);
    const grade      = gradeInput.value; // letter grade (A–F)

    if (!courseCode || isNaN(courseUnit) || courseUnit <= 0) {
        showAlert("Please fill in Course Code and Course Unit correctly.", "error");
        return;
    }

    const courseCodePattern = /^[A-Za-z]{2,4}\s\d{3}$/;
    if (!courseCodePattern.test(courseCode)) {
        showAlert("Invalid course code! Example: CSC 411 or MTH 102", "error");
        return;
    }

    if (!grade) {
        showAlert("Please select a grade.", "error");
        return;
    }

    const course = {
        id: Date.now(),
        courseCode,
        courseUnit,
        grade
    };

    courses.push(course);

    const table = document.querySelector("#courseTable tbody");
    const row   = table.insertRow();
    row.setAttribute("data-id", course.id);

    row.insertCell(0).textContent = courseCode;
    row.insertCell(1).textContent = courseUnit;
    row.insertCell(2).textContent = grade;
    row.insertCell(3).innerHTML   = `<button onclick="deleteCourse(${course.id})">Delete</button>`;

    courseCodeInput.value    = "";
    courseUnitInput.value    = "";
    gradeInput.selectedIndex = 0;
}

async function calculateCGPA() {
    if (courses.length === 0) {
        showAlert("Please add at least one course.", "error");
        return;
    }

    // Get level and semester selections
    const levelSelect    = document.getElementById("levelSelect");
    const semesterSelect = document.getElementById("semesterSelect");

    if (!levelSelect || !semesterSelect) {
        showAlert("Level and semester selectors not found.", "error");
        return;
    }

    const level    = levelSelect.value;
    const semester = semesterSelect.value;

    if (!level || !semester) {
        showAlert("Please select your level and semester.", "error");
        return;
    }

    const token = getToken();
    const user  = getUser();

    if (!token || !user) {
        showAlert("Please login first", "error");
        return;
    }

    if (isTokenExpired(token)) {
        showAlert("Your session has expired. Please login again.", "warning");
        logout();
        return;
    }

    const formattedCourses = courses.map(course => ({
        course: course.courseCode,
        unit:   course.courseUnit,
        grade:  course.grade
    }));

    try {
        const res = await fetch(`${BASE_URL}/api/save-result`, {
            method:  "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                studentEmail: user.email,
                level,
                semester,
                courses: formattedCourses
            })
        });

        const data = await res.json();

        if (res.ok) {
            const { gpa, academicClass, totalUnits } = data.result;
            const { cgpa, cgpaClass, totalSemesters } = data.cumulative;

            // Show semester result
            document.getElementById("result").innerHTML =
                `<strong>${level} ${semester}</strong><br>
                 Semester GPA: ${gpa} / 5.00 — ${academicClass}<br>
                 Cumulative CGPA: <strong>${cgpa} / 5.00</strong> — ${cgpaClass}<br>
                 (${totalSemesters} semester${totalSemesters > 1 ? "s" : ""} recorded, ${totalUnits} units this semester)`;

            showAlert(
                `GPA: ${gpa} | Cumulative CGPA: ${cgpa} (${cgpaClass})`,
                "success",
                "Result Saved"
            );

            // Clear courses for next entry
            courses = [];
            document.querySelector("#courseTable tbody").innerHTML = "";

            // Refresh stats
            loadResultsFromBackend();

        } else {
            // Show duplicate warning clearly
            showAlert(data.message || "Failed to save result", "error");
        }

    } catch (error) {
        console.error(error);
        showAlert("Server error", "error");
    }
}

function deleteCourse(courseId) {
    courses = courses.filter(c => c.id !== courseId);
    const row = document.querySelector(`[data-id="${courseId}"]`);
    if (row) row.remove();
}

// ===========================
// LOAD CUMULATIVE CGPA
// ===========================

async function loadCumulativeCGPA() {
    const token = getToken();
    const user  = getUser();

    if (!token || !user) return;

    try {
        const res = await fetch(`${BASE_URL}/api/cgpa/${user.email}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) return;

        const data = await res.json();

        // Dashboard cumulative CGPA card
        const cgpaCard    = document.getElementById("cumulativeCgpaCard");
        const cgpaStatus  = document.getElementById("cumulativeCgpaStatus");
        const cgpaSemesters = document.getElementById("cgpaSemesters");

        if (cgpaCard)     cgpaCard.textContent     = data.cgpa > 0 ? data.cgpa.toFixed(2) : "—";
        if (cgpaStatus)   cgpaStatus.textContent   = data.cgpaClass;
        if (cgpaSemesters) cgpaSemesters.textContent = data.totalSemesters + " semester(s) recorded";

        // Also update older dashboard cards if they exist
        const lastCgpaCard  = document.getElementById("lastCgpaCard");
        const statusCard    = document.getElementById("statusCard");

        if (lastCgpaCard) lastCgpaCard.textContent = data.cgpa > 0 ? data.cgpa.toFixed(2) : "—";
        if (statusCard)   statusCard.textContent   = data.cgpaClass;

    } catch (err) {
        console.error("Error loading CGPA:", err);
    }
}

// ===========================
// LOAD RESULTS FROM BACKEND
// ===========================

async function loadResultsFromBackend() {
    const token = getToken();
    const user  = getUser();

    if (!token || !user) return;

    try {
        const res = await fetch(`${BASE_URL}/api/results/${user.email}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) {
            console.warn("Could not fetch results:", res.status);
            return;
        }

        const results = await res.json(); // sorted by level then semester

        // ---- RESULTS LIST PAGE ----
        const resultsList = document.getElementById("resultsList");
        if (resultsList) {
            resultsList.innerHTML = "";

            if (results.length === 0) {
                resultsList.innerHTML =
                    "<li class='empty-state'>No results yet. Calculate your CGPA first.</li>";
            } else {
                results.forEach(result => {
                    const li   = document.createElement("li");
                    const date = new Date(result.date).toLocaleDateString();

                    li.innerHTML = `
                        <div class="result-item">
                            <div class="result-item-info">
                                <strong>${result.level} — ${result.semester}</strong>
                                <span>GPA: ${result.gpa} / 5.00</span>
                                <span>${result.academicClass}</span>
                                <small>${date}</small>
                            </div>
                            <button class="delete-btn" onclick="deleteResult('${result._id}')">Delete</button>
                        </div>
                    `;
                    resultsList.appendChild(li);
                });
            }
        }

        // ---- RESULTS PAGE STATS ----
        const historyCount = document.getElementById("historyCount");
        const highestCgpa  = document.getElementById("highestCgpa");
        const latestCgpa   = document.getElementById("latestCgpa");

        if (historyCount) historyCount.textContent = results.length;

        if (results.length > 0) {
            const gpas    = results.map(r => r.gpa);
            const highest = Math.max(...gpas);
            const latest  = gpas[gpas.length - 1];

            if (highestCgpa) highestCgpa.textContent = highest.toFixed(2);
            if (latestCgpa)  latestCgpa.textContent  = latest.toFixed(2);
        }

        // ---- RESULTS PAGE SUMMARY ----
        const lastCgpa          = document.getElementById("lastCgpa");
        const totalCalculations = document.getElementById("totalCalculations");
        const academicStatus    = document.getElementById("academicStatus");

        if (lastCgpa && totalCalculations && academicStatus) {
            if (results.length > 0) {
                const latest = results[results.length - 1];
                lastCgpa.textContent          = "Last Semester GPA: " + latest.gpa;
                totalCalculations.textContent = "Total Semesters: "   + results.length;
                academicStatus.textContent    = "Academic Status: "   + latest.academicClass;
            } else {
                lastCgpa.textContent          = "Last Semester GPA: —";
                totalCalculations.textContent = "Total Semesters: 0";
                academicStatus.textContent    = "Academic Status: —";
            }
        }

        // ---- DASHBOARD TOTAL SEMESTERS CARD ----
        const totalCalcCard = document.getElementById("totalCalcCard");
        if (totalCalcCard) totalCalcCard.textContent = results.length;

        // Also reload cumulative CGPA
        loadCumulativeCGPA();

    } catch (err) {
        console.error("Error loading results:", err);
    }
}

// ===========================
// DELETE SINGLE RESULT
// ===========================

async function deleteResult(resultId) {
    const token = getToken();

    if (!token) return;

    if (!confirm("Delete this semester result? This cannot be undone.")) return;

    try {
        const res = await fetch(`${BASE_URL}/api/results/${resultId}`, {
            method:  "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        if (res.ok) {
            showAlert("Result deleted.", "success");
            loadResultsFromBackend();
        } else {
            showAlert(data.message || "Failed to delete result", "error");
        }

    } catch (err) {
        console.error(err);
        showAlert("Server error", "error");
    }
}

// ===========================
// CLEAR ALL RESULTS
// ===========================

async function clearResults() {
    const token = getToken();
    const user  = getUser();

    if (!token || !user) return;

    if (!confirm("Delete ALL your CGPA records? This cannot be undone.")) return;

    try {
        const res = await fetch(`${BASE_URL}/api/results/${user.email}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        const results = await res.json();

        await Promise.all(
            results.map(result =>
                fetch(`${BASE_URL}/api/results/${result._id}`, {
                    method:  "DELETE",
                    headers: { "Authorization": "Bearer " + token }
                })
            )
        );

        showAlert("All results cleared.", "success");
        loadResultsFromBackend();

    } catch (err) {
        console.error(err);
        showAlert("Failed to clear results.", "error");
    }
}

// Auto-load on protected pages
const resultPages = ["dashboard.html", "results.html", "calculator.html"];
if (resultPages.includes(currentPage)) {
    loadResultsFromBackend();
}

// =====================
// PROFILE — LOAD DATA
// =====================

async function loadProfile() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${BASE_URL}/api/profile`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) return;

        const data = await res.json();

        // Populate profile form fields
        const profileFullname = document.getElementById("profileFullname");
        const profileMatric   = document.getElementById("profileMatric");
        const profileEmail    = document.getElementById("profileEmail");

        if (profileFullname) profileFullname.value = data.fullname;
        if (profileMatric)   profileMatric.value   = data.matric;
        if (profileEmail)    profileEmail.value     = data.email;

        // Update profile display name at top of page
        const profileDisplayName = document.getElementById("profileDisplayName");
        const profileDisplayEmail = document.getElementById("profileDisplayEmail");

        if (profileDisplayName)  profileDisplayName.textContent  = data.fullname;
        if (profileDisplayEmail) profileDisplayEmail.textContent = data.email;

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// =====================
// PROFILE — UPDATE INFO
// =====================

async function updateProfile() {
    const token    = getToken();
    if (!token) return;

    const fullname = document.getElementById("profileFullname").value.trim();
    const matric   = document.getElementById("profileMatric").value.trim();

    if (!fullname || !matric) {
        showAlert("Fullname and matric number are required.", "error");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/profile`, {
            method:  "PUT",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ fullname, matric })
        });

        const data = await res.json();

        if (res.ok) {
            // Update localStorage so sidebar/welcome reflects new name
            const user = getUser();
            user.fullname = data.user.fullname;
            user.matric   = data.user.matric;
            localStorage.setItem("user", JSON.stringify(user));

            showAlert("Profile updated successfully!", "success");

            // Refresh display name
            const profileDisplayName = document.getElementById("profileDisplayName");
            if (profileDisplayName) profileDisplayName.textContent = data.user.fullname;

        } else {
            showAlert(data.message || "Failed to update profile", "error");
        }

    } catch (err) {
        console.error(err);
        showAlert("Server error. Try again.", "error");
    }
}

// =====================
// PROFILE — CHANGE PASSWORD
// =====================

async function changePassword() {
    const token = getToken();
    if (!token) return;

    const oldPassword     = document.getElementById("oldPassword").value;
    const newPassword     = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmNewPassword").value;

    if (!oldPassword || !newPassword || !confirmPassword) {
        showAlert("All password fields are required.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert("New passwords do not match.", "error");
        return;
    }

    if (newPassword.length < 5) {
        showAlert("New password must be at least 5 characters.", "error");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/profile/password`, {
            method:  "PUT",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            showAlert("Password changed successfully! Please login again.", "success");

            // Clear password fields
            document.getElementById("oldPassword").value        = "";
            document.getElementById("newPassword").value        = "";
            document.getElementById("confirmNewPassword").value = "";

            // Force re-login since password changed
            setTimeout(() => logout(), 2000);

        } else {
            showAlert(data.message || "Failed to change password", "error");
        }

    } catch (err) {
        console.error(err);
        showAlert("Server error. Try again.", "error");
    }
}

// Auto-load profile page
if (currentPage === "profile.html") {
    loadProfile();
}

// =====================
// LOGOUT
// =====================

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("loggedIn");
    window.location.href = "index.html";
}

// ==========================
// ADMIN DASHBOARD FUNCTIONS
// ==========================

async function loadAdminDashboard() {
    const token = getToken();
    if (!token) return;

    await loadAdminStats();
    await loadAdminStudents();
}

// ---- ADMIN STATS ----

async function loadAdminStats() {
    const token = getToken();
    if (!token) return;

    try {
        const res  = await fetch(`${BASE_URL}/api/admin/stats`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) return;

        const data = await res.json();

        const totalStudentsEl  = document.getElementById("adminTotalStudents");
        const totalResultsEl   = document.getElementById("adminTotalResults");
        const firstClassEl     = document.getElementById("adminFirstClass");
        const secondUpperEl    = document.getElementById("adminSecondUpper");
        const secondLowerEl    = document.getElementById("adminSecondLower");
        const thirdClassEl     = document.getElementById("adminThirdClass");
        const probationEl      = document.getElementById("adminProbation");

        if (totalStudentsEl) totalStudentsEl.textContent = data.totalStudents;
        if (totalResultsEl)  totalResultsEl.textContent  = data.totalResults;
        if (firstClassEl)    firstClassEl.textContent    = data.classCounts["First Class"]        || 0;
        if (secondUpperEl)   secondUpperEl.textContent   = data.classCounts["Second Class Upper"] || 0;
        if (secondLowerEl)   secondLowerEl.textContent   = data.classCounts["Second Class Lower"] || 0;
        if (thirdClassEl)    thirdClassEl.textContent    = data.classCounts["Third Class"]        || 0;
        if (probationEl)     probationEl.textContent     = data.classCounts["Probation"]          || 0;

    } catch (err) {
        console.error("Error loading admin stats:", err);
    }
}

// ---- ADMIN STUDENTS TABLE ----

async function loadAdminStudents() {
    const token = getToken();
    if (!token) return;

    try {
        // Fetch students and all results together
        const [studentsRes, resultsRes] = await Promise.all([
            fetch(`${BASE_URL}/api/admin/students`, { headers: { "Authorization": "Bearer " + token } }),
            fetch(`${BASE_URL}/api/admin/results`,  { headers: { "Authorization": "Bearer " + token } })
        ]);

        const students = await studentsRes.json();
        const results  = await resultsRes.json();

        const tbody = document.getElementById("adminStudentTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No students registered yet.</td></tr>`;
            return;
        }

        students.forEach(student => {
            // Calculate this student's cumulative CGPA from results
            const studentResults = results.filter(r => r.studentEmail === student.email);
            const allCourses     = studentResults.flatMap(r => r.courses);

            let cgpa      = "—";
            let cgpaClass = "—";

            if (allCourses.length > 0) {
                const weighted = allCourses.reduce((sum, c) => sum + (c.gradePoint * c.unit), 0);
                const units    = allCourses.reduce((sum, c) => sum + c.unit, 0);
                cgpa           = (weighted / units).toFixed(2);
                cgpaClass      = gpaToClassFrontend(parseFloat(cgpa));
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${student.fullname}</td>
                <td>${student.matric}</td>
                <td>${student.email}</td>
                <td>${studentResults.length} semester(s)</td>
                <td>${cgpa} ${cgpaClass !== "—" ? "(" + cgpaClass + ")" : ""}</td>
                <td>
                    <button class="btn-view"   onclick="viewStudentResults('${student.email}', '${student.fullname}')">View Results</button>
                    <button class="btn-danger" onclick="adminDeleteStudent('${student._id}', '${student.fullname}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error("Error loading admin students:", err);
    }
}

// Helper: GPA → class label (frontend version, no backend call needed)
function gpaToClassFrontend(gpa) {
    if (gpa >= 4.50) return "First Class";
    if (gpa >= 3.50) return "Second Class Upper";
    if (gpa >= 2.40) return "Second Class Lower";
    if (gpa >= 1.50) return "Third Class";
    return "Probation";
}

// ---- VIEW STUDENT RESULTS ----

async function viewStudentResults(email, fullname) {
    const token = getToken();
    if (!token) return;

    try {
        const res     = await fetch(`${BASE_URL}/api/results/${email}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        const results = await res.json();

        const panel      = document.getElementById("studentResultsPanel");
        const panelTitle = document.getElementById("resultsPanelTitle");
        const panelBody  = document.getElementById("resultsPanelBody");

        if (!panel) return;

        panelTitle.textContent = `Results for ${fullname}`;
        panelBody.innerHTML    = "";

        if (results.length === 0) {
            panelBody.innerHTML = "<p>No results submitted yet.</p>";
        } else {
            results.forEach(result => {
                const date = new Date(result.date).toLocaleDateString();
                const div  = document.createElement("div");
                div.className = "result-item";
                div.innerHTML = `
                    <div class="result-item-info">
                        <strong>${result.level} — ${result.semester}</strong>
                        <span>GPA: ${result.gpa} / 5.00</span>
                        <span>${result.academicClass}</span>
                        <small>${date}</small>
                    </div>
                    <button class="btn-danger" onclick="adminDeleteResult('${result._id}')">Delete</button>
                `;
                panelBody.appendChild(div);
            });
        }

        panel.style.display = "block";
        panel.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        console.error("Error loading student results:", err);
        showAlert("Failed to load student results.", "error");
    }
}

// ---- ADMIN DELETE RESULT ----

async function adminDeleteResult(resultId) {
    const token = getToken();
    if (!token) return;

    if (!confirm("Delete this result permanently?")) return;

    try {
        const res  = await fetch(`${BASE_URL}/api/results/${resultId}`, {
            method:  "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        if (res.ok) {
            showAlert("Result deleted.", "success");
            // Reload the panel and table
            loadAdminStudents();
            document.getElementById("studentResultsPanel").style.display = "none";
        } else {
            showAlert(data.message || "Failed to delete result", "error");
        }

    } catch (err) {
        console.error(err);
        showAlert("Server error.", "error");
    }
}

// ---- ADMIN DELETE STUDENT ----

async function adminDeleteStudent(studentId, fullname) {
    const token = getToken();
    if (!token) return;

    if (!confirm(`Delete student "${fullname}" and ALL their results? This cannot be undone.`)) return;

    try {
        const res  = await fetch(`${BASE_URL}/api/admin/students/${studentId}`, {
            method:  "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        if (res.ok) {
            showAlert(data.message, "success");
            loadAdminDashboard();
            document.getElementById("studentResultsPanel").style.display = "none";
        } else {
            showAlert(data.message || "Failed to delete student", "error");
        }

    } catch (err) {
        console.error(err);
        showAlert("Server error.", "error");
    }
}

// Auto-load admin dashboard
if (currentPage === "admin-dashboard.html") {
    loadAdminDashboard();
}
