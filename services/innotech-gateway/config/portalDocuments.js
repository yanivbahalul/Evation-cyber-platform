'use strict';

const fs = require('fs');
const path = require('path');

/** Drop PDF / DOCX / XLSX files here — they appear automatically in the portal. */
const DOCUMENTS_DIR = path.join(__dirname, '../portal-documents');

const MIME_BY_EXT = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.doc': 'application/msword',
    '.xls': 'application/vnd.ms-excel',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

function formatUpdated(mtimeMs) {
    return new Date(mtimeMs).toISOString().slice(0, 10);
}

function isAllowedFile(name) {
    if (!name || name.startsWith('.')) return false;
    const ext = path.extname(name).toLowerCase();
    return ext in MIME_BY_EXT;
}

function safeFilePath(filename) {
    const base = path.basename(decodeURIComponent(String(filename || '').trim()));
    if (!isAllowedFile(base)) return null;
    const filePath = path.resolve(DOCUMENTS_DIR, base);
    const root = path.resolve(DOCUMENTS_DIR);
    if (!filePath.startsWith(root + path.sep) && filePath !== root) return null;
    return filePath;
}

function readDocumentEntry(name, filePath) {
    const ext = path.extname(name).toLowerCase();
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return {
        name,
        type: ext.slice(1).toUpperCase(),
        updated: formatUpdated(stat.mtimeMs),
        mime: MIME_BY_EXT[ext],
        filePath,
    };
}

function listPortalDocuments() {
    if (!fs.existsSync(DOCUMENTS_DIR)) return [];
    return fs
        .readdirSync(DOCUMENTS_DIR)
        .filter(isAllowedFile)
        .map((name) => {
            try {
                return readDocumentEntry(name, path.join(DOCUMENTS_DIR, name));
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => b.updated.localeCompare(a.updated) || a.name.localeCompare(b.name));
}

function resolvePortalDocument(filename) {
    const filePath = safeFilePath(filename);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
        return readDocumentEntry(path.basename(filePath), filePath);
    } catch {
        return null;
    }
}

module.exports = {
    DOCUMENTS_DIR,
    listPortalDocuments,
    resolvePortalDocument,
};
