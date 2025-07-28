const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const userRoutes = require('./routes/user');

app.use(cors());
app.use(express.json());

// ✅ Add this test route to check if backend is working
app.get("/", (req, res) => {
  res.status(200).json({ message: "✅ Backend is live and working!" });
});

// Main user API route
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
