import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MAX_LOGIN_ATTEMPTS = 5;      // Max failed login attempts before lockout
const LOCK_TIME = 30 * 60 * 1000;  // Lock duration in milliseconds (30 minutes)

/**
 * Mongoose schema for a user.
 * Manages user authentication and account security features.
 */
const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,        // Username is mandatory
            unique: true,          // Ensures no duplicate usernames
            trim: true,            // Removes leading/trailing whitespace
            minlength: 3,          // Minimum length for username
            maxlength: 30,         // Maximum length for username
            validate: {
                validator: function (v) {
                    return /^[A-Za-z0-9_]+$/.test(v); // Alphanumeric and underscores only
                },
                message: (props) =>
                    `${props.value} is not a valid username! Use only letters, numbers, and underscores.`,
            },
        },
        email: {
            type: String,
            required: true,        // Email is mandatory
            unique: true,          // Ensures no duplicate emails
            trim: true,            // Removes leading/trailing whitespace
            index: true,           // Optimizes email-based queries
            validate: {
                validator: function (v) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); // Basic email format check
                },
                message: (props) => `${props.value} is not a valid email address!`,
            },
        },
        password: {
            type: String,
            required: true,        // Password is mandatory
            minlength: 8,          // Minimum length for security
        },
        isAdmin: {
            type: Boolean,
            default: false,        // Non-admin by default
        },
        resetPasswordToken: String, // Token for password reset (optional)
        resetPasswordExpires: Date, // Expiration for reset token (optional)
        loginAttempts: { 
            type: Number, 
            default: 0             // Tracks failed login attempts
        },
        lockUntil: { 
            type: Number           // Timestamp for account lockout (in ms)
        },
    },
    { timestamps: true }           // Adds createdAt and updatedAt fields
);

// Pre-save hook to normalize username to lowercase
UserSchema.pre("save", function (next) {
    if (this.username) {
        this.username = this.username.toLowerCase(); // Ensures case-insensitive uniqueness
    }
    next();
});

// Pre-save hook to hash password
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next(); // Skip if password unchanged
    try {
        const salt = await bcrypt.genSalt(10);       // Generate salt with 10 rounds
        this.password = await bcrypt.hash(this.password, salt); // Hash password
        next();
    } catch (error) {
        next(error);                                 // Pass errors to next middleware
    }
});

/**
 * Virtual property to check if the user account is locked.
 * @returns {boolean} True if account is locked, false otherwise
 */
UserSchema.virtual("isLocked").get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now()); // Locked if lockUntil is set and not expired
});

/**
 * Compares a candidate password with the stored hash.
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password); // Uses bcrypt for secure comparison
};

/**
 * Increments login attempts and locks account if limit reached.
 * @returns {Promise} Resolves with update result
 */
UserSchema.methods.incrementLoginAttempts = function () {
    if (this.isLocked) {
        // If locked, check if lock has expired
        if (Date.now() > this.lockUntil) {
            return this.updateOne({
                $set: { loginAttempts: 1 },      // Reset to 1 attempt
                $unset: { lockUntil: 1 },        // Clear lock
            }).exec();
        }
        return this.updateOne({ $inc: { loginAttempts: 1 } }).exec(); // Increment while locked
    }

    // Increment attempts and lock if max reached
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
        updates.$set = { lockUntil: Date.now() + LOCK_TIME }; // Set lock duration
    }
    return this.updateOne(updates).exec();
};

/**
 * Resets login attempts after successful login.
 * @returns {Promise} Resolves with update result
 */
UserSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $set: { loginAttempts: 0 },      // Reset attempts to 0
        $unset: { lockUntil: 1 },        // Clear any lock
    }).exec();
};

/**
 * Checks if the user can log in (not locked).
 * @returns {boolean} True if login is allowed, false if locked
 */
UserSchema.methods.canLogin = function () {
    return !this.isLocked;               // Based on virtual isLocked
};

/**
 * Mongoose model for the User collection.
 * @type {mongoose.Model}
 */
const User = mongoose.model("User", UserSchema);

export default User;
