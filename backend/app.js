import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { authRoute, userRoute, productRoute, cartRoute, orderRoute } from "./routes/index.js";

dotenv.config();

const app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/carts", cartRoute);
app.use("/api/v1/orders", orderRoute);

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.DB_URI)
    console.log("Successfully connected to the database");
  } catch (err) {
    console.error("Could not connect to the database:", err);
    process.exit(1);
  }
}

connectToDatabase();

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
