const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 1, maxlength: 64 },
    passwordHash: { type: String },
    password: { type: String, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
    totpSecretEnc: { type: String, select: false },
    totpSecretIv: { type: String, select: false },
    totpSecretTag: { type: String, select: false },
    totpEnabled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'admin_users' }
);

module.exports = AdminUserSchema;
