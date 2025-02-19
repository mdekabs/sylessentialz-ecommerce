import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^[A-Za-z]+$/.test(v); // Ensures only alphabets (A-Z, a-z)
            },
            message: props => `${props.value} is not a valid username! It should contain only alphabets.`
        }
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: {
        type: String,
    },
    resetPasswordExpires: {
        type: Date,
    }
}, { timestamps: true });

// Pre-save middleware to convert username to lowercase
UserSchema.pre("save", function (next) {
    if (this.username) {
        this.username = this.username.toLowerCase();
    }
    next();
});

export default mongoose.model('User', UserSchema);
