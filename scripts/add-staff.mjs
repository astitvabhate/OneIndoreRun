// Adds or updates organiser and volunteer logins from a CSV file (see scripts/staff.example.csv).
// Run with: npm run staff:add            (reads staff.csv in the project root)
//       or: npm run staff:add -- my.csv
//
// Columns: username, name, role (admin | volunteer), password, active (yes | no, optional).
//   • A new account with an empty password gets a generated one.
//   • An existing account with an empty password keeps its current password.
//   • active = no switches an account off: it is signed out and cannot sign in.
// Generated passwords are printed and saved to staff-credentials.csv to hand out. That file and
// staff.csv hold real passwords: both are git-ignored; delete them once everyone has theirs.
// Only scrypt hashes are stored in the database (same format as lib/server/adminAuth.ts).

import { randomBytes, randomInt, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const file = process.argv[2] ?? 'staff.csv';
const outFile = 'staff-credentials.csv';

/** Splits one CSV line, allowing "quoted, values". */
function cells(line) {
  const out = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted && c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { out.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  out.push(cell.trim());
  return out;
}

const csvValue = (value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes such as l/1 and o/0
const generatePassword = () =>
  Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')).join('-');

const hashPassword = (password) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${scryptSync(password, salt, 64).toString('base64url')}`;
};

let text;
try {
  text = readFileSync(file, 'utf8').replace(/^﻿/, '');
} catch {
  console.error(`Could not read ${file}. Copy scripts/staff.example.csv to ${file} and fill it in.`);
  process.exit(1);
}

const [header, ...lines] = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'));
const columns = cells(header).map((c) => c.toLowerCase());
for (const required of ['username', 'name', 'role']) {
  if (!columns.includes(required)) {
    console.error(`${file} needs a "${required}" column. Columns: username,name,role,password,active`);
    process.exit(1);
  }
}

const rows = [];
const problems = [];
const seen = new Set();
lines.forEach((line, index) => {
  const values = cells(line);
  const get = (name) => values[columns.indexOf(name)] ?? '';
  const row = {
    line: index + 2,
    username: get('username').toLowerCase(),
    name: get('name'),
    role: get('role').toLowerCase(),
    password: get('password'),
    active: !['no', 'false', '0'].includes(get('active').toLowerCase()),
  };
  if (!/^[a-z0-9._-]{3,32}$/.test(row.username)) problems.push(`line ${row.line}: username must be 3–32 of a-z, 0-9, . _ -`);
  else if (seen.has(row.username)) problems.push(`line ${row.line}: username ${row.username} appears twice`);
  if (row.name.length < 2 || row.name.length > 40) problems.push(`line ${row.line}: name must be 2–40 characters`);
  if (!['admin', 'volunteer'].includes(row.role)) problems.push(`line ${row.line}: role must be admin or volunteer`);
  if (row.password && row.password.length < 10) problems.push(`line ${row.line}: password must be at least 10 characters (or leave it empty)`);
  seen.add(row.username);
  rows.push(row);
});
if (problems.length) {
  console.error(`Nothing was saved. Fix these in ${file}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const api = (path, init = {}) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...init.headers },
  });

const existingResponse = await api('staff_users?select=username');
if (!existingResponse.ok) {
  console.error('Could not read staff_users. Has supabase/upgrade_staff_accounts.sql been run?', await existingResponse.text());
  process.exit(1);
}
const existing = new Set((await existingResponse.json()).map((r) => r.username));

const handOut = [];
let added = 0;
let updated = 0;
for (const row of rows) {
  const isNew = !existing.has(row.username);
  let password = row.password;
  if (!password && isNew) {
    password = generatePassword();
    handOut.push({ ...row, password });
  }
  const record = { username: row.username, name: row.name, role: row.role, active: row.active };
  if (password) record.password_hash = hashPassword(password);

  const response = isNew
    ? await api('staff_users', { method: 'POST', body: JSON.stringify(record) })
    : await api(`staff_users?username=eq.${encodeURIComponent(row.username)}`, { method: 'PATCH', body: JSON.stringify(record) });
  if (!response.ok) {
    console.error(`  ✗ ${row.username}: ${await response.text()}`);
    process.exitCode = 1;
    continue;
  }
  isNew ? added++ : updated++;
  console.log(`  ✓ ${row.username.padEnd(20)} ${row.role.padEnd(9)} ${isNew ? 'added' : 'updated'}${password ? '' : ' (password unchanged)'}${row.active ? '' : ' — switched off'}`);
}

console.log(`\n${added} added, ${updated} updated.`);
if (handOut.length) {
  writeFileSync(outFile, ['username,name,role,password', ...handOut.map((r) => [r.username, r.name, r.role, r.password].map(csvValue).join(','))].join('\n') + '\n');
  console.log(`\nGenerated passwords (also saved to ${outFile}; delete it once handed out):`);
  for (const r of handOut) console.log(`  ${r.username.padEnd(20)} ${r.password}`);
}
