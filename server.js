const express = require("express");
const connectDb = require("./config/db");
const cors = require("cors");
const hotelRoutes = require("./routes/hotel.routes");
const visitorRoutes = require("./routes/visitor.routes");
const statsRoutes = require("./routes/stats.routes");

require("dotenv").config();

const PORT = process.env.PORT || 5000;
const app = express();

app.use(
  cors({ 
    origin: "*", 
  })
);
app.use(express.json());

connectDb();

// Routes
app.use("/hotel", hotelRoutes);
app.use("/visitor", visitorRoutes);
app.use("/dashboard", statsRoutes);

app.get("/", (req, res, next) => {
  res.send("API is running...");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
