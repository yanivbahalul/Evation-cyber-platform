'use strict';

const path = require('path');

const DOCUMENTS_DIR = path.join(__dirname, '../assets/documents');

/** Internal HR / IT files shown in the portal and served at GET /documents/:name */
const PORTAL_DOCUMENTS = [
    {
        name: 'Employee Handbook (2026).pdf',
        type: 'PDF',
        updated: '2026-04-18',
        mime: 'application/pdf',
    },
    {
        name: 'Remote Work Policy.pdf',
        type: 'PDF',
        updated: '2026-03-02',
        mime: 'application/pdf',
    },
    {
        name: 'IT Onboarding Checklist.docx',
        type: 'DOCX',
        updated: '2026-02-11',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
        name: 'Travel Expenses Form.xlsx',
        type: 'XLSX',
        updated: '2026-01-29',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
        name: 'Corporate VPN Client — Install Guide.pdf',
        type: 'PDF',
        updated: '2025-12-07',
        mime: 'application/pdf',
    },
];

const byName = new Map(PORTAL_DOCUMENTS.map((doc) => [doc.name, doc]));

function listPortalDocuments() {
    return PORTAL_DOCUMENTS.map(({ name, type, updated }) => ({ name, type, updated }));
}

function resolvePortalDocument(filename) {
    const decoded = decodeURIComponent(String(filename || '').trim());
    const doc = byName.get(decoded);
    if (!doc) return null;
    const filePath = path.join(DOCUMENTS_DIR, doc.name);
    if (!filePath.startsWith(DOCUMENTS_DIR)) return null;
    return { ...doc, filePath };
}

module.exports = {
    DOCUMENTS_DIR,
    PORTAL_DOCUMENTS,
    listPortalDocuments,
    resolvePortalDocument,
};
