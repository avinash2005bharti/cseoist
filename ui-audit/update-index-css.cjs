const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../frontend/src/index.css');
const content = fs.readFileSync(indexPath, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('D. SCREEN 5, 6, 7 & 8: TUTOR GUARDIAN WORKSPACE & REVIEWS'));
const endIndex = lines.findIndex(l => l.includes('E. SCREEN 9, 10, 11 & 12: HOD DASHBOARD & CLEARANCES'));

console.log('startIndex:', startIndex, 'endIndex:', endIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers');
  process.exit(1);
}

const replacement = [
  '/* --------------------------------------------------------------------------',
  '   D. SCREEN 5, 6, 7 & 8: TUTOR GUARDIAN PORTAL (CAMPUSFLOW INDIGO)',
  '   Matching Screen 5.png (Desktop), Screen 6.png (Mobile),',
  '   Screen 7.png (Review Drawer), and Screen 8.png (Review Sheet)',
  '   -------------------------------------------------------------------------- */',
  '',
  '/* Full-width Portal Layout (No Desktop Sidebar) */',
  '.app-container.tg-portal-mode,',
  '.app-container:has(header a[href*="/tg"]),',
  '.app-container:has(header a[href="/tg"]) {',
  '  background-color: #F8FAFC !important;',
  '}',
  '',
  '/* Hide sidebar in TG views */',
  '.app-container.tg-portal-mode .sidebar,',
  '.app-container.tg-portal-mode .sidebar-container,',
  '.app-container:has(header a[href*="/tg"]) .sidebar,',
  '.app-container:has(header a[href*="/tg"]) .sidebar-container,',
  '.app-container:has(header a[href="/tg"]) .sidebar,',
  '.app-container:has(header a[href="/tg"]) .sidebar-container {',
  '  display: none !important;',
  '}',
  '',
  '/* Full width main container */',
  '.app-container.tg-portal-mode .main-content,',
  '.app-container.tg-portal-mode main,',
  '.app-container:has(header a[href*="/tg"]) .main-content,',
  '.app-container:has(header a[href*="/tg"]) main,',
  '.app-container:has(header a[href="/tg"]) .main-content,',
  '.app-container:has(header a[href="/tg"]) main {',
  '  margin-left: 0 !important;',
  '  width: 100% !important;',
  '  max-width: 100% !important;',
  '  background-color: #F8FAFC !important;',
  '}',
  '',
  '/* Ensure header logo squircle uses clean React icon without legacy overlay */',
  'header a[href*="/tg"] > div:first-child::after,',
  'header a[href="/tg"] > div:first-child::after {',
  '  display: none !important;',
  '  content: none !important;',
  '}',
  '',
  '/* Hide toggle hamburger on TG views */',
  '.app-container.tg-portal-mode header button[aria-label="Toggle Navigation Menu"],',
  '.app-container:has(header a[href*="/tg"]) header button[aria-label="Toggle Navigation Menu"],',
  '.app-container:has(header a[href="/tg"]) header button[aria-label="Toggle Navigation Menu"] {',
  '  display: none !important;',
  '}',
  '',
  '/* CampusFlow Indigo CSS Variables for TG Portal */',
  '.tg-portal-mode {',
  '  --primary: 243 75% 59%;',
  '  --primary-foreground: 210 40% 98%;',
  '  --ring: 243 75% 59%;',
  '}',
  ''
];

const newLines = [
  ...lines.slice(0, startIndex),
  ...replacement,
  ...lines.slice(endIndex)
];

fs.writeFileSync(indexPath, newLines.join('\n'), 'utf8');
console.log('Successfully updated index.css! New total lines:', newLines.length);
