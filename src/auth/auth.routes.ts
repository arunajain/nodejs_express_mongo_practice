import express from "express";
const router = express.Router();
router.post("/register", (req, res) => {
  res.status(200).json({ message: "registered successfully" });
});
router.post("/login", (req, res) => {
  res.status(200).json({ message: "registered successfully" });
});
export default router;
