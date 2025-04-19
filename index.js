require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.API_KEY;
const uploadDir = path.join(__dirname, "uploads");

app.use(cors());

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    cb(null, `${fileId}${fileExtension}`);
  },
});
const upload = multer({ storage });
const authenticateBearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Unauthorized: No Bearer token provided" });
  }
  const token = authHeader.split(" ")[1];
  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
  next();
};

app.use("/uploads", express.static(uploadDir));
app.get("/api/file/:id", authenticateBearer, (req, res) => {
  const fileId = req.params.id;
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Server error: Could not read directory" });
    }
    const file = files.find((f) => f.startsWith(fileId));
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${file}`;
    res.json({ url: fileUrl, filename: file });
  });
});
app.post("/api/file", authenticateBearer, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }
  const fileId = path.parse(req.file.filename).name;
  res.json({
    id: fileId,
    filename: req.file.filename,
    url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});
app.delete("/api/file/:id", authenticateBearer, (req, res) => {
  const fileId = req.params.id;
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Server error: Could not read directory" });
    }
    const file = files.find((f) => f.startsWith(fileId));
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    fs.unlink(path.join(uploadDir, file), (unlinkErr) => {
      if (unlinkErr) {
        return res
          .status(500)
          .json({ error: "Server error: Could not delete file" });
      }
      res.json({ message: "File deleted successfully", id: fileId });
    });
  });
});

app.listen(PORT, () => {
  console.log(`File API server running on port ${PORT}`);
  console.log(`Uploaded files will be stored in ${uploadDir}`);
});
