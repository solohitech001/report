const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path"); // Add path module to serve static files

// Initialize the app
const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb+srv://solohitechnology01:solohitech09@cluster0.hs0r01y.mongodb.net/Report", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Report Schema
const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  reports: [reportSchema], // Embedding reports in the user schema
});

const User = mongoose.model("User", userSchema);

// Secret for JWT
const JWT_SECRET = "your_jwt_secret_key"; // Replace with a secure key

// Serve static files from the "dist" folder
app.use(express.static(path.join(__dirname, "dist")));

// Register Route
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      reports: [],
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Middleware for token verification
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request object
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Add a Report to a User
app.post("/api/users/:userId/reports", async (req, res) => {
  const { userId } = req.params;
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "Title and description are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.reports.push({ title, description });
    await user.save();

    res.status(201).json({ message: "Report added successfully", reports: user.reports });
  } catch (error) {
    console.error("Error adding report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get All Reports of a User
app.get("/api/users/:userId/reports", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ reports: user.reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update a Report
app.put("/api/users/:userId/reports/:reportId", async (req, res) => {
  const { userId, reportId } = req.params;
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "Title and description are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const report = user.reports.id(reportId);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    report.title = title;
    report.description = description;
    await user.save();

    res.status(200).json({ message: "Report updated successfully", report });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected Route Example
app.get("/api/protected", authenticateToken, (req, res) => {
  res.status(200).json({ message: "Protected content", user: req.user });
});

// Catch-all route to handle requests to static files
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
