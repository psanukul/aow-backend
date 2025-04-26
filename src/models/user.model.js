// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt'; // Keep if you also support password signup

const { Schema } = mongoose;

const userSchema = new Schema({
    username: {
        type: String,
        unique: true,
        sparse: true, 
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: false, 
        minlength: [6, 'Password must be at least 6 characters long']
    },
    provider: {
        type: String,
        required: true,
        enum: ['google', 'facebook', 'github', 'local'], 
        default: 'local', 
    },
    providerId: {
        type: String,
        unique: true, 
        sparse: true, 
    },
    displayName: {
        type: String,
        trim: true,
    },
    avatarUrl: { 
        type: String,
        trim: true,
    },

}, {
    timestamps: true 
});

// Optional: Create a compound index for provider + providerId if you allow multiple providers
// and want to ensure the providerId is unique *for that specific provider*
// userSchema.index({ provider: 1, providerId: 1 }, { unique: true, sparse: true });
// Note: The single unique sparse index on providerId might suffice for simpler cases where
// providerId is guaranteed unique across all providers you use, or if you only store providerId
// for non-'local' users. Evaluate based on your specific OAuth provider IDs.

// --- Password Hashing (Only if password is provided - for 'local' signup) ---
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new) AND it exists
    if (!this.isModified('password') || !this.password) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});


const User = mongoose.model('User', userSchema);

export default User;