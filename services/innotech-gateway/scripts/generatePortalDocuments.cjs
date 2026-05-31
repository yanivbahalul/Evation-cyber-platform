'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DOCUMENTS_DIR, PORTAL_DOCUMENTS } = require('../config/portalDocuments');

function writePdf(filePath, title, lines) {
    const text = lines.map((line) => line.replace(/[()\\]/g, '\\$&')).join('\\n');
    const content = `BT /F1 11 Tf 72 720 Td (${title.replace(/[()\\]/g, '\\$&')}) Tj 0 -18 Td (${text}) Tj ET`;
    const objects = [
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj',
        `4 0 obj<</Length ${Buffer.byteLength(content, 'utf8')}>>stream\n${content}\nendstream\nendobj`,
        '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    ];
    let body = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(body, 'utf8'));
        body += `${obj}\n`;
    }
    const xrefPos = Buffer.byteLength(body, 'utf8');
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
        body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;
    fs.writeFileSync(filePath, body, 'utf8');
}

function zipOfficeDocument(outPath, entries) {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'innotech-doc-'));
    try {
        for (const [rel, content] of entries) {
            const full = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content, 'utf8');
        }
        execFileSync('zip', ['-qr', outPath, '.'], { cwd: tmp });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function writeDocx(filePath, title, paragraphs) {
    const body = paragraphs
        .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`)
        .join('');
    zipOfficeDocument(filePath, [
        ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`],
        ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`],
        ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>
    ${body}
  </w:body>
</w:document>`],
    ]);
}

function writeXlsx(filePath, sheetName, rows) {
    const escape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const sheetRows = rows
        .map((row, idx) => {
            const cells = row
                .map((cell, col) => `<c r="${String.fromCharCode(65 + col)}${idx + 1}" t="inlineStr"><is><t>${escape(cell)}</t></is></c>`)
                .join('');
            return `<row r="${idx + 1}">${cells}</row>`;
        })
        .join('');
    zipOfficeDocument(filePath, [
        ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`],
        ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`],
        ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`],
        ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`],
    ]);
}

const GENERATORS = {
    'Employee Handbook (2026).pdf': () =>
        writePdf(path.join(DOCUMENTS_DIR, 'Employee Handbook (2026).pdf'), 'InnoTech Employee Handbook 2026', [
            'Welcome to InnoTech. This handbook covers workplace conduct, benefits,',
            'leave policies, and information security expectations for all employees.',
            'Acknowledge receipt via the HR portal within 14 days of hire.',
        ]),
    'Remote Work Policy.pdf': () =>
        writePdf(path.join(DOCUMENTS_DIR, 'Remote Work Policy.pdf'), 'InnoTech Remote Work Policy', [
            'Eligible employees may work remotely up to 3 days per week with manager approval.',
            'Company VPN is required for all remote access to internal systems.',
            'Confidential materials must not be stored on personal devices.',
        ]),
    'IT Onboarding Checklist.docx': () =>
        writeDocx(path.join(DOCUMENTS_DIR, 'IT Onboarding Checklist.docx'), 'IT Onboarding Checklist', [
            '1. Collect laptop from IT (Building A, 4th floor)',
            '2. Enroll device in MDM and install corporate VPN client',
            '3. Enable 2FA on email and SSO accounts',
            '4. Complete security awareness training in the learning portal',
            '5. Sign acceptable use policy in HR documents',
        ]),
    'Travel Expenses Form.xlsx': () =>
        writeXlsx(path.join(DOCUMENTS_DIR, 'Travel Expenses Form.xlsx'), 'Expenses', [
            ['Date', 'Description', 'Category', 'Amount (ILS)', 'Receipt #'],
            ['2026-01-15', 'Taxi to client site', 'Transport', '120', 'R-1042'],
            ['2026-01-16', 'Team lunch', 'Meals', '85', 'R-1043'],
            ['', '', 'Total', '205', ''],
        ]),
    'Corporate VPN Client — Install Guide.pdf': () =>
        writePdf(path.join(DOCUMENTS_DIR, 'Corporate VPN Client — Install Guide.pdf'), 'Corporate VPN Client Install Guide', [
            'Download the InnoTech VPN client from the internal software catalog.',
            'Run the installer and import the profile provided by IT support.',
            'Connect using your SSO credentials and approve the 2FA prompt.',
        ]),
};

fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

for (const doc of PORTAL_DOCUMENTS) {
    const gen = GENERATORS[doc.name];
    if (!gen) {
        throw new Error(`Missing generator for ${doc.name}`);
    }
    gen();
    console.log(`Wrote ${doc.name}`);
}

console.log(`Generated ${PORTAL_DOCUMENTS.length} portal documents in ${DOCUMENTS_DIR}`);
