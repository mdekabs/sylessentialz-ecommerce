import "..config/env.js";
import mongoose from "mongoose";
import { User } from "../models/index.js";
import { connectDB } from "../config/_database.js";


const ADMIN_ROLE = "admin";
const ERROR_MESSAGES = {
  SERVER_ERROR: "Failed to create admin user",
  ALREADY_EXISTS: "Admin user already exists",
};

async function createAdmin() {
  try {
    await connectDB();
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    }

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(ERROR_MESSAGES.ALREADY_EXISTS);
      return;
    }

    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      role: ADMIN_ROLE,
    });

    await adminUser.save();
    console.log("Admin user created successfully:", adminEmail);
  } catch (error) {
    console.error(`${ERROR_MESSAGES.SERVER_ERROR}: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  }
}

createAdmin();