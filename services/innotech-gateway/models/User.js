const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 64 },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
        isActive: { type: Boolean, default: true, index: true },
        // Per-user TOTP secret for 2FA (store encrypted in production; plaintext is acceptable for a demo).
        totpSecret: { type: String, select: false },
        totpEnabled: { type: Boolean, default: false, index: true },
    },
    { timestamps: true, collection: 'users' }
);

// Create the model based on the schema 
module.exports = mongoose.model('User', userSchema);