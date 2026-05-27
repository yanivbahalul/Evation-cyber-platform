const mongoose = require('mongoose');

/** Legitimate HR portal accounts (REAL_EMPLOYEE per project spec). */
const RealEmployeeSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 64 },
    passwordHash: { type: String, required: true, select: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
    isActive: { type: Boolean, default: true, index: true },
    totpSecret: { type: String, select: false },
    totpEnabled: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'real_employees' }
);

module.exports = RealEmployeeSchema;
