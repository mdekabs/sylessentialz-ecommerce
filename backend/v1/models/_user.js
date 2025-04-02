import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MAX_LOGIN_ATTEMPTS = 5; // Max failed attempts before lock
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes lock duration

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
            validate: {
                validator: function (v) {
                    return /^[A-Za-z0-9_]+$/.test(v); // Allows letters, numbers, and underscores
                },
                message: (props) =>
                    `${props.value} is not a valid username! Use only letters, numbers, and underscores.`,
            },
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
            validate: {
                validator: function (v) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: (props) => `${props.value} is not a valid email address!`,
            },
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        resetPasswordToken: String,
        resetPasswordExpires: Date,
        loginAttempts: { type: Number, default: 0 }, // Track failed attempts
        lockUntil: { type: Number }, // Timestamp when account is locked
    },
    { timestamps: true }
);

// Convert username to lowercase before saving
UserSchema.pre("save", function (next) {
    if (this.username) {
        this.username = this.username.toLowerCase();
    }
    next();
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Check if user is currently locked
UserSchema.virtual("isLocked").get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Compare hashed passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts and lock account if needed
UserSchema.methods.incrementLoginAttempts = function () {
    if (this.isLocked) {
        // If locked, check if lock time has expired
        if (Date.now() > this.lockUntil) {
            return this.updateOne({
                $set: { loginAttempts: 1 },
                $unset: { lockUntil: 1 },
            }).exec();
        }
        return this.updateOne({ $inc: { loginAttempts: 1 } }).exec();
    }

    // Increment attempts
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
        updates.$set = { lockUntil: Date.now() + LOCK_TIME };
    }
    return this.updateOne(updates).exec();
};

// Reset login attempts on successful login
UserSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 },
    }).exec();
};

// Check if user can log in
UserSchema.methods.canLogin = function () {
    return !this.isLocked;
};

const User = mongoose.model("User", UserSchema);

export default User;
