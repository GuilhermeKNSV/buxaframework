import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const checks = [
  { root: "scripts", ext: ".js", soft: 500, hard: 700 },
  { root: "styles", ext: ".css", soft: 800, hard: 1000 },
  { root: "templates", ext: ".hbs", soft: 350, hard: 500 }
];

function walk(dir, ext, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, output);
    else if (entry.name.endsWith(ext)) output.push(full);
  }
  return output;
}

function lineCount(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).length;
}

function checkLocalReferences(file, expression, label) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(expression)) {
    const referenced = match[1];
    if (!referenced.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), referenced);
    if (fs.existsSync(target)) continue;
    console.error(`MISSING ${label}: ${path.relative(cwd, file)} -> ${referenced}`);
    failed = true;
  }
}

let failed = false;
let warnings = 0;
let checked = 0;

for (const check of checks) {
  for (const file of walk(path.resolve(check.root), check.ext)) {
    checked += 1;
    const lines = lineCount(file);
    const relative = path.relative(cwd, file);
    if (lines >= check.hard) {
      console.error(`HARD LIMIT: ${relative} (${lines} lines; limit ${check.hard})`);
      failed = true;
    } else if (lines >= check.soft) {
      console.warn(`SOFT LIMIT: ${relative} (${lines} lines; target < ${check.soft})`);
      warnings += 1;
    }
    if (check.ext === ".js") {
      checkLocalReferences(file, /(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g, "JS DEPENDENCY");
    } else if (check.ext === ".css") {
      checkLocalReferences(file, /@import\s+(?:url\()?\s*["']([^"']+)["']/g, "CSS IMPORT");
    }
  }
}

const mainFile = path.resolve("scripts/main.js");
if (fs.existsSync(mainFile)) {
  const lines = lineCount(mainFile);
  if (lines > 250) {
    console.error(`BOOTSTRAP LIMIT: scripts/main.js (${lines} lines; limit 250)`);
    failed = true;
  }
}

const modulePath = path.resolve("module.json");
if (fs.existsSync(modulePath)) {
  const moduleData = JSON.parse(fs.readFileSync(modulePath, "utf8"));
  for (const style of moduleData.styles ?? []) {
    if (!fs.existsSync(path.resolve(style))) {
      console.error(`MISSING STYLE: ${style}`);
      failed = true;
    }
  }
  for (const entry of moduleData.esmodules ?? []) {
    if (!fs.existsSync(path.resolve(entry))) {
      console.error(`MISSING ES MODULE: ${entry}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`Architecture check passed: ${checked} source files checked${warnings ? `, ${warnings} soft warning(s)` : ""}.`);
