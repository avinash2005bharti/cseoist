const fs = require('fs');
const filePath = 'frontend/src/index.css';
let content = fs.readFileSync(filePath, 'utf8');

const target = `/* Full-width Portal Layout (No Desktop Sidebar) */
.app-container.tg-portal-mode,
.app-container:has(header a[href*="/tg"]),
.app-container:has(header a[href="/tg"]) {
  background-color: #F8FAFC !important;
}

/* Hide sidebar in TG views */
.app-container.tg-portal-mode .sidebar,
.app-container.tg-portal-mode .sidebar-container,
.app-container:has(header a[href*="/tg"]) .sidebar,
.app-container:has(header a[href*="/tg"]) .sidebar-container,
.app-container:has(header a[href="/tg"]) .sidebar,
.app-container:has(header a[href="/tg"]) .sidebar-container {
  display: none !important;
}

/* Full width main container */
.app-container.tg-portal-mode .main-content,
.app-container.tg-portal-mode main,
.app-container:has(header a[href*="/tg"]) .main-content,
.app-container:has(header a[href*="/tg"]) main,
.app-container:has(header a[href="/tg"]) .main-content,
.app-container:has(header a[href="/tg"]) main {
  margin-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  background-color: #F8FAFC !important;
}

/* Ensure header logo squircle uses clean React icon without legacy overlay */
header a[href*="/tg"] > div:first-child::after,
header a[href="/tg"] > div:first-child::after {
  display: none !important;
  content: none !important;
}

/* Hide toggle hamburger on TG views */
.app-container.tg-portal-mode header button[aria-label="Toggle Navigation Menu"],
.app-container:has(header a[href*="/tg"]) header button[aria-label="Toggle Navigation Menu"],
.app-container:has(header a[href="/tg"]) header button[aria-label="Toggle Navigation Menu"] {
  display: none !important;
}`;

const replacement = `/* Desktop Sidebar Layout for TG Portal */
.app-container.tg-portal-mode,
.app-container:has(header a[href*="/tg"]),
.app-container:has(header a[href="/tg"]) {
  background-color: #F8FAFC !important;
}

@media (min-width: 1024px) {
  .app-container.tg-portal-mode .sidebar,
  .app-container:has(header a[href*="/tg"]) .sidebar,
  .app-container:has(header a[href="/tg"]) .sidebar {
    display: flex !important;
    width: var(--sidebar-width) !important;
  }

  .app-container.tg-portal-mode .main-content.sidebar-open,
  .app-container:has(header a[href*="/tg"]) .main-content.sidebar-open,
  .app-container:has(header a[href="/tg"]) .main-content.sidebar-open {
    margin-left: var(--sidebar-width) !important;
    width: calc(100% - var(--sidebar-width)) !important;
    max-width: calc(100% - var(--sidebar-width)) !important;
  }

  .app-container.tg-portal-mode .main-content.sidebar-closed,
  .app-container:has(header a[href*="/tg"]) .main-content.sidebar-closed,
  .app-container:has(header a[href="/tg"]) .main-content.sidebar-closed {
    margin-left: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}

/* Ensure header logo squircle uses clean React icon without legacy overlay */
header a[href*="/tg"] > div:first-child::after,
header a[href="/tg"] > div:first-child::after {
  display: none !important;
  content: none !important;
}`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
if (!normContent.includes(normTarget)) {
  console.error('Target block not found!');
  process.exit(1);
}

const updated = normContent.replace(normTarget, replacement);
fs.writeFileSync(filePath, updated, 'utf8');
console.log('Successfully updated index.css TG sidebar rules!');
