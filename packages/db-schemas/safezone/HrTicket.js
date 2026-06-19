const mongoose = require('mongoose');

/** HR / IT helpdesk tickets submitted through the Safe Zone portal. */
const HrTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
    source: {
      type: String,
      enum: ['profile_edit', 'contact', 'dashboard'],
      default: 'contact',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'closed'],
      default: 'open',
      index: true,
    },
    isSuspicious: { type: Boolean, default: false, index: true },
    suspiciousReasons: { type: [String], default: [] },
    submittedBy: { type: String, default: null, trim: true, index: true },
    submitterIp: { type: String, required: true, trim: true, index: true },
    submitterUserAgent: { type: String, default: '' },
    traceId: { type: String, default: null, index: true },
  },
  { timestamps: true, collection: 'hr_tickets' }
);

module.exports = HrTicketSchema;
