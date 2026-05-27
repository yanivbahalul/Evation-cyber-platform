#!/usr/bin/env node
/**
 * One-time migration: copy documents from `users` → `real_employees` when target is empty.
 *
 * Usage:
 *   SAFEZONE_DB_URI="mongodb://..." node scripts/migrate-users-to-real-employees.js
 */
const mongoose = require('mongoose');
const { RealEmployeeSchema, SafezoneUserSchema } = require('@evation/db-schemas');

async function main() {
  const uri = process.env.SAFEZONE_DB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set SAFEZONE_DB_URI or MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const legacy = mongoose.model('LegacyUser', SafezoneUserSchema);
  const RealEmployee = mongoose.model('RealEmployee', RealEmployeeSchema);

  const existing = await RealEmployee.countDocuments();
  if (existing > 0) {
    console.log(`real_employees already has ${existing} document(s); skipping copy.`);
    await mongoose.disconnect();
    return;
  }

  const docs = await legacy.find().lean();
  if (!docs.length) {
    console.log('No documents in users collection; nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  await RealEmployee.insertMany(
    docs.map((d) => ({
      username: d.username,
      passwordHash: d.passwordHash,
      role: d.role,
      isActive: d.isActive,
      totpSecret: d.totpSecret,
      totpEnabled: d.totpEnabled,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
  );

  console.log(`Migrated ${docs.length} user(s) to real_employees.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
