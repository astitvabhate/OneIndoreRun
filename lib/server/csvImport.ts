import { event, isValidDate } from '../eventData';
import { ageOnRaceDay, formatRegNo, type RegistrationInput } from '../registrationSchema';
import { adminEditSchema, type AdminEdit } from './admin';
import { db, markPaid, recordOrder, savePending } from './db';
import { saveOrganisation } from './organisations';

// Bulk entries from an organisation's spreadsheet, e.g. a school's list of students. Each valid row
// becomes a paid registration with its own OIRI number and ticket, exactly as if the runner had paid
// online, except the payment is recorded as collected offline (payment id "offline_…") at whatever
// the organisation paid per runner, which may be nothing. Every runner is linked to the organisation
// (see organisations.ts), so its tickets can be downloaded and its kits handed over together.

export const maxImportRows = 2000;
export const maxImportBytes = 2 * 1024 * 1024;

/** What the organiser fills in once for the whole file; used wherever a row leaves a column empty. */
export interface ImportDefaults {
  organisation: string;
  race: string;
  tshirtSize: string;
  city: string;
  address: string;
  pincode: string;
  email: string;
  contactName: string;
  contactMobile: string;
  note: string;
  feeInr: number;
}

export interface RowProblem { row: number; name: string; message: string }
export interface Imported { row: number; name: string; regNo: string; race: string; ticketId: string }

export interface ImportReport {
  mode: 'check' | 'import';
  fileName: string;
  totalRows: number;
  valid: number;
  columns: { found: string[]; ignored: string[] };
  problems: RowProblem[];
  preview: { row: number; name: string; race: string; tshirtSize: string; dateOfBirth: string; mobile: string }[];
  imported: Imported[];
  alreadyRegistered: RowProblem[];
  organisationId?: string; // after an import, for the link to its Groups page
}

// ─── CSV ─────────────────────────────────────────────────────────────────────────────────────

/** Splits CSV text into rows of cells. Handles quotes, escaped quotes, CRLF, and ; or tab files from Excel. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const delimiter = counts.reduce((best, next) => (next[1] > best[1] ? next : best))[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) rows.push([...row, cell]);
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

// ─── Columns ─────────────────────────────────────────────────────────────────────────────────

type Column =
  | 'firstName' | 'middleName' | 'lastName' | 'fullName' | 'mobile' | 'email' | 'dateOfBirth' | 'gender' | 'bloodGroup'
  | 'occupation' | 'city' | 'address' | 'pincode' | 'race' | 'tshirtSize' | 'emergencyName' | 'emergencyMobile'
  | 'guardianName' | 'guardianMobile';

// Header spellings we accept, compared lowercase with spaces and punctuation removed.
const aliases: Record<Column, string[]> = {
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  middleName: ['middlename', 'middle', 'mname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  fullName: ['name', 'fullname', 'studentname', 'participantname', 'runnername', 'nameofstudent', 'nameofparticipant'],
  mobile: ['mobile', 'mobileno', 'mobilenumber', 'phone', 'phoneno', 'phonenumber', 'contact', 'contactno', 'contactnumber', 'whatsapp', 'whatsappno'],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'birthday', 'dobddmmyyyy'],
  gender: ['gender', 'sex'],
  bloodGroup: ['bloodgroup', 'blood'],
  occupation: ['occupation', 'profession'],
  city: ['city', 'town'],
  address: ['address', 'fulladdress', 'residentialaddress'],
  pincode: ['pincode', 'pin', 'postalcode', 'zip', 'zipcode'],
  race: ['race', 'category', 'distance', 'run', 'racecategory'],
  tshirtSize: ['tshirt', 'tshirtsize', 'size', 'tsize', 'shirtsize'],
  emergencyName: ['emergencyname', 'emergencycontact', 'emergencycontactname'],
  emergencyMobile: ['emergencymobile', 'emergencyphone', 'emergencynumber', 'emergencycontactmobile', 'emergencycontactnumber'],
  guardianName: ['guardianname', 'guardian', 'parentname', 'parent', 'fathername', 'mothername', 'parentguardianname'],
  guardianMobile: ['guardianmobile', 'guardianphone', 'guardiancontact', 'parentmobile', 'parentphone', 'parentcontact', 'fathermobile', 'mothermobile', 'parentguardianmobile'],
};

const columnTitles: Record<Column, string> = {
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', fullName: 'Full name', mobile: 'Mobile',
  email: 'Email', dateOfBirth: 'Date of birth', gender: 'Gender', bloodGroup: 'Blood group', occupation: 'Occupation',
  city: 'City', address: 'Address', pincode: 'Pincode', race: 'Race', tshirtSize: 'T-shirt', emergencyName: 'Emergency name',
  emergencyMobile: 'Emergency mobile', guardianName: 'Guardian name', guardianMobile: 'Guardian mobile',
};

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

function mapColumns(headers: string[]) {
  const index: Partial<Record<Column, number>> = {};
  const ignored: string[] = [];
  headers.forEach((header, i) => {
    const key = headerKey(header);
    const column = (Object.keys(aliases) as Column[]).find((name) => aliases[name].includes(key));
    if (column && index[column] === undefined) index[column] = i;
    else if (header.trim()) ignored.push(header.trim());
  });
  return { index, ignored };
}

/** A sample file organisers can fill in. */
export const templateCsv = [
  'First name,Last name,Date of birth,Gender,Mobile,Race,T-shirt,Guardian name,Guardian mobile,Email',
  'Aarav,Sharma,15/08/2012,Male,9876543210,5 KM,M,Rakesh Sharma,9876543210,',
  'Diya,Patel,2011-03-02,Female,9123456780,3 KM,S,Neha Patel,9123456780,',
].join('\r\n');

// ─── Values ──────────────────────────────────────────────────────────────────────────────────

/** 10-digit Indian mobile from "+91 98765-43210", "098765 43210" and the like. */
function cleanMobile(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** YYYY-MM-DD from 2012-08-15, 15/08/2012, 15-8-2012, 15.08.2012 or 15-Aug-2012 (day first, as in India). */
function cleanDate(value: string) {
  const text = value.trim();
  const pad = (n: number | string) => String(n).padStart(2, '0');
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  match = text.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  match = text.match(/^(\d{1,2})[-/. ]([a-z]{3})[a-z]*[-/. ,]+(\d{4})$/i);
  if (match && months.includes(match[2].toLowerCase())) return `${match[3]}-${pad(months.indexOf(match[2].toLowerCase()) + 1)}-${pad(match[1])}`;
  return text;
}

function cleanGender(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return '';
  if (['m', 'male', 'boy', 'man'].includes(text)) return 'Male';
  if (['f', 'female', 'girl', 'woman'].includes(text)) return 'Female';
  return 'Other';
}

/** '3km' etc. from "3", "3 KM", "3K", "5 km run". */
function cleanRace(value: string) {
  const distance = value.match(/\d+/)?.[0];
  return event.races.find((race) => race.slug === `${distance}km`)?.slug ?? value.trim();
}

function cleanSize(value: string) {
  const text = value.trim().toUpperCase().replace(/\s/g, '');
  return text === '2XL' ? 'XXL' : text;
}

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
function cleanBloodGroup(value: string) {
  const text = value.toUpperCase().replace(/\s/g, '').replace(/POSITIVE$|POS$/, '+').replace(/NEGATIVE$|NEG$/, '-').replace(/VE$/, '');
  return bloodGroups.includes(text) ? text : '';
}

/** Splits "Aarav Kumar Sharma" into first, middle and last name. */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? '', middle: '', last: '' };
  return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] };
}

// ─── Rows ────────────────────────────────────────────────────────────────────────────────────

interface ParsedRow { row: number; name: string; edit?: AdminEdit; message?: string }

function readRow(cells: string[], index: Partial<Record<Column, number>>, defaults: ImportDefaults, row: number): ParsedRow {
  const get = (column: Column) => (index[column] === undefined ? '' : (cells[index[column]!] ?? '').trim());
  const split = splitName(get('fullName'));
  const firstName = get('firstName') || split.first;
  const lastName = get('lastName') || split.last;
  const middleName = get('middleName') || (get('firstName') ? '' : split.middle);
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ') || '(no name)';

  const dateOfBirth = cleanDate(get('dateOfBirth'));
  const minor = isValidDate(dateOfBirth) && ageOnRaceDay(dateOfBirth) < 18;
  const guardianMobile = cleanMobile(get('guardianMobile')) || (minor ? cleanMobile(defaults.contactMobile) : '');
  const guardianName = get('guardianName') || (minor ? defaults.contactName : '');
  const mobile = cleanMobile(get('mobile')) || guardianMobile || cleanMobile(defaults.contactMobile);

  const input = {
    firstName,
    middleName,
    lastName,
    mobile,
    email: get('email') || defaults.email,
    city: get('city') || defaults.city,
    address: get('address') || defaults.address,
    pincode: get('pincode').replace(/\s/g, '') || defaults.pincode,
    dateOfBirth,
    gender: cleanGender(get('gender')),
    bloodGroup: cleanBloodGroup(get('bloodGroup')),
    occupation: get('occupation') || 'Student',
    category: get('race') ? cleanRace(get('race')) : defaults.race,
    tshirtSize: get('tshirtSize') ? cleanSize(get('tshirtSize')) : defaults.tshirtSize,
    emergencyName: get('emergencyName') || guardianName || defaults.contactName,
    emergencyMobile: cleanMobile(get('emergencyMobile')) || guardianMobile || cleanMobile(defaults.contactMobile),
    guardianName,
    guardianMobile,
    adminNotes: defaults.note,
  };

  const parsed = adminEditSchema.safeParse(input);
  if (parsed.success) return { row, name, edit: parsed.data };
  const issues = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const message = Object.entries(issues)
    .map(([field, errors]) => `${fieldTitle(field)}: ${errors?.[0]}`)
    .join(' · ');
  return { row, name, message: message || 'Check this row.' };
}

const fieldTitle = (field: string) =>
  ({ category: 'Race', tshirtSize: 'T-shirt', gender: 'Gender (Male / Female / Other)' } as Record<string, string>)[field] ??
  columnTitles[field as Column] ?? field;

const raceName = (slug: string) => event.races.find((race) => race.slug === slug)?.distance ?? slug;

/** The form fields as save_pending_registration expects them; the organiser has confirmed consent for everyone. */
const toInput = (edit: AdminEdit): RegistrationInput => ({
  firstName: edit.firstName,
  middleName: edit.middleName ?? undefined,
  lastName: edit.lastName,
  mobile: edit.mobile,
  email: edit.email,
  city: edit.city,
  address: edit.address,
  pincode: edit.pincode,
  dateOfBirth: edit.dateOfBirth,
  gender: edit.gender,
  bloodGroup: edit.bloodGroup ?? undefined,
  occupation: edit.occupation ?? undefined,
  category: edit.category,
  tshirtSize: edit.tshirtSize,
  emergencyName: edit.emergencyName,
  emergencyMobile: edit.emergencyMobile,
  guardianName: edit.guardianName ?? undefined,
  guardianMobile: edit.guardianMobile ?? undefined,
  consentRisk: true,
  consentRules: true,
  consentMedia: true,
});

type Outcome = { imported: Imported } | { already: RowProblem } | { problem: RowProblem };

/** Saves one runner and records their offline payment, which gives them the next OIRI number. */
async function importOne({ row, name, edit }: ParsedRow & { edit: AdminEdit }, defaults: ImportDefaults, organisationId: string, fileName: string, by: string): Promise<Outcome> {
  const race = raceName(edit.category);
  const saved = await savePending(toInput(edit));
  if (saved.status === 'full') return { problem: { row, name, message: `The ${race} run is sold out.` } };
  if (saved.status === 'cancelled') return { problem: { row, name, message: `Already in the ${race} run but cancelled. Restore it from the runner's page instead.` } };
  if (saved.status === 'paid') {
    // Paid already (e.g. online): leave the payment alone, but add them to this group so its ticket PDF
    // and kit hand-over include them, unless they already belong to another group.
    const { data: linked } = await db().from('registrations').update({ organisation_id: organisationId }).eq('id', saved.id).is('organisation_id', null).select('id');
    const note = linked?.length ? ' Added to this group.' : '';
    return { already: { row, name, message: `Already registered for the ${race} run (${formatRegNo(saved.regNo!)}).${note}` } };
  }

  const orderId = `offline_${saved.id.slice(0, 8)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await recordOrder(saved.id, orderId, Math.round(defaults.feeInr * 100));
  const paid = await markPaid(orderId, orderId);
  if (!paid || (paid.outcome !== 'paid' && paid.outcome !== 'already_paid')) {
    // No money moved for an offline entry, so nothing is owed back: close the attempt instead of listing a refund.
    await db().from('payments').update({ status: 'failed', refund_reason: null }).eq('order_id', orderId);
    if (paid?.outcome === 'duplicate') return { already: { row, name, message: `Already registered for the ${race} run (${formatRegNo(paid.regNo)}).` } };
    return { problem: { row, name, message: paid?.outcome === 'sold_out' ? `The ${race} run sold out during the import.` : 'Could not be marked as paid.' } };
  }

  await db().from('registrations').update({ organisation_id: organisationId }).eq('id', saved.id);
  if (defaults.note) await db().from('registrations').update({ admin_notes: defaults.note }).eq('id', saved.id).is('admin_notes', null);
  await db().from('audit_log').insert({
    registration_id: saved.id,
    action: 'edited',
    actor: by,
    details: { changes: { status: { from: 'pending', to: `paid (imported from ${fileName} for ${defaults.organisation})` } } },
  });
  return { imported: { row, name, regNo: formatRegNo(paid.regNo), race, ticketId: saved.id } };
}

/** Runs tasks a few at a time, in order of their results. */
async function pool<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await task(items[i]);
      }
    }),
  );
  return results;
}

/** Checks the file (mode 'check') or checks and imports every valid row (mode 'import'). */
export async function runImport(text: string, fileName: string, defaults: ImportDefaults, mode: 'check' | 'import', by: string): Promise<ImportReport | string> {
  const [headers, ...body] = parseCsv(text);
  if (!headers) return 'The file is empty.';
  if (body.length === 0) return 'The file has a header row but no runners.';
  if (body.length > maxImportRows) return `The file has ${body.length.toLocaleString('en-IN')} rows. Please split it into files of at most ${maxImportRows.toLocaleString('en-IN')}.`;

  const { index, ignored } = mapColumns(headers);
  const hasName = index.fullName !== undefined || (index.firstName !== undefined && index.lastName !== undefined);
  if (!hasName) return 'Could not find the name columns. Add "First name" and "Last name" columns, or one "Name" column with the full name.';
  if (index.dateOfBirth === undefined) return 'Could not find a "Date of birth" column. It is needed for the age check and to tell runners apart.';
  if (index.gender === undefined) return 'Could not find a "Gender" column.';

  // Spreadsheet row numbers: the header is row 1.
  const rows = body.map((cells, i) => readRow(cells, index, defaults, i + 2));
  const valid = rows.filter((row): row is ParsedRow & { edit: AdminEdit } => !!row.edit);
  const report: ImportReport = {
    mode,
    fileName,
    totalRows: rows.length,
    valid: valid.length,
    columns: { found: (Object.keys(index) as Column[]).map((column) => columnTitles[column]), ignored },
    problems: rows.filter((row) => row.message).map(({ row, name, message }) => ({ row, name, message: message! })),
    preview: valid.slice(0, 8).map(({ row, name, edit }) => ({
      row, name, race: raceName(edit.category), tshirtSize: edit.tshirtSize, dateOfBirth: edit.dateOfBirth, mobile: edit.mobile,
    })),
    imported: [],
    alreadyRegistered: [],
  };
  if (mode === 'check') return report;

  const organisationId = await saveOrganisation(defaults.organisation, defaults.contactName, cleanMobile(defaults.contactMobile));
  report.organisationId = organisationId;
  const outcomes = await pool(valid, 6, (row) =>
    importOne(row, defaults, organisationId, fileName, by).catch((error): Outcome => {
      console.error('CSV import: row failed', row.row, error);
      return { problem: { row: row.row, name: row.name, message: 'Could not be saved (database error). Import the file again to retry this row.' } };
    }),
  );
  for (const outcome of outcomes) {
    if ('imported' in outcome) report.imported.push(outcome.imported);
    else if ('already' in outcome) report.alreadyRegistered.push(outcome.already);
    else report.problems.push(outcome.problem);
  }
  report.problems.sort((a, b) => a.row - b.row);
  return report;
}
