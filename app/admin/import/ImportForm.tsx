'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { FileCheck2, LoaderCircle, TriangleAlert, Upload, X } from 'lucide-react';
import { importRunners, type ImportState } from '../actions';

type Report = NonNullable<NonNullable<ImportState>['report']>;

/** Upload form: "Check file" validates without saving; "Import" saves every valid row. The file stays selected between the two. */
export function ImportForm({ races, sizes, feeLabel, organisations, organisation }: {
  races: string[][]; sizes: string[]; feeLabel: string; organisations: string[]; organisation: string;
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importRunners, undefined);
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<'check' | 'import'>('check');
  const [checked, setChecked] = useState(false); // false again once the file or a default changes
  const report = state?.report;
  const canImport = checked && report?.mode === 'check' && report.valid > 0;
  const [confirming, setConfirming] = useState<FormData>(); // the import waiting for the organiser's OK

  const run = (data: FormData) => {
    const next = data.get('mode') === 'import' ? 'import' : 'check';
    setMode(next);
    setChecked(next === 'check');
    startTransition(() => action(data));
  };

  // Submitting by hand stops React resetting the form (and clearing the chosen file) after each run.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    if (data.get('mode') === 'import') setConfirming(data);
    else run(data);
  };

  return (
    <>
      <section className="adminPanel">
        <form className="adminForm" onSubmit={submit} onChange={() => setChecked(false)}>
          <fieldset>
            <legend>Organisation</legend>
            <span className="wide">
              <label>
                Organisation (school, company, club)
                <input name="organisation" list="import-organisations" defaultValue={organisation} required minLength={2} maxLength={120} placeholder="e.g. Delhi Public School, Nipania" />
              </label>
            </span>
            <datalist id="import-organisations">{organisations.map((name) => <option key={name} value={name} />)}</datalist>
            <label>Contact Person's Name<input name="contactName" maxLength={80} placeholder="e.g. teacher in charge" /></label>
            <label>Contact Mobile Number<input name="contactMobile" inputMode="numeric" maxLength={10} /></label>
          </fieldset>
          <fieldset>
            <legend>Runners</legend>
            <label className="wide">
              CSV file
              <input type="file" name="file" accept=".csv,text/csv" required />
            </label>
            <label>Fee paid per runner (₹)<input name="feeInr" type="number" min={0} max={100000} defaultValue={0} required /></label>
            <label className="wide importConsent">
              <input type="checkbox" name="consent" required />
              <span>The organisation / parents have accepted the risk, rules and photo consents for every runner in this file.</span>
            </label>
          </fieldset>
          <details className="importMore">
            <summary>More options <small>Race, T-shirt, email, address and a note, used where the file leaves a cell empty</small></summary>
            <fieldset>
              <label>
                Race
                <select name="race" defaultValue="">
                  <option value="">From the file</option>
                  {races.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
                </select>
              </label>
              <label>
                T-shirt size
                <select name="tshirtSize" defaultValue="">
                  <option value="">From the file</option>
                  {sizes.map((size) => <option key={size}>{size}</option>)}
                </select>
              </label>
              <label>Email<input name="email" type="email" maxLength={120} /></label>
              <label>City<input name="city" defaultValue="Indore" maxLength={80} /></label>
              <label>Pincode<input name="pincode" inputMode="numeric" maxLength={6} /></label>
              <span className="wide"><label>Address<input name="address" maxLength={300} /></label></span>
              <span className="wide"><label>Note on every runner (e.g. receipt no.)<input name="note" maxLength={300} /></label></span>
            </fieldset>
          </details>
          {state?.message && <p className="adminError" role="alert">{state.message}</p>}
          <div className="importActions">
            <button className="button outline" type="submit" name="mode" value="check" disabled={pending}><FileCheck2 size={16} /> Check file</button>
            <button className="button" type="submit" name="mode" value="import" disabled={pending || !canImport}>
              <Upload size={16} /> {canImport ? `Import ${report.valid} runner${report.valid === 1 ? '' : 's'}` : 'Import'}
            </button>
          </div>
          {!canImport && <p className="adminHint">Check the file first: Import turns on once at least one row is valid. The contact person stands in as guardian and emergency contact where a row has none. Full entry fee is {feeLabel}.</p>}
        </form>
      </section>

      {confirming && report && (
        <ConfirmImport
          data={confirming}
          report={report}
          races={races}
          onCancel={() => setConfirming(undefined)}
          onConfirm={() => {
            setConfirming(undefined);
            run(confirming);
          }}
        />
      )}

      {pending && (
        <section className="adminPanel importBusy" role="status">
          <LoaderCircle size={22} className="spin" aria-hidden />
          {mode === 'import' ? 'Importing runners… a few hundred rows can take a minute. Keep this page open.' : 'Checking the file…'}
        </section>
      )}

      {report && !pending && <ReportPanel report={report} />}
    </>
  );
}

/** Asks before importing, with what is about to happen spelled out. */
function ConfirmImport({ data, report, races, onCancel, onConfirm }: { data: FormData; report: Report; races: string[][]; onCancel: () => void; onConfirm: () => void }) {
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const field = (name: string) => String(data.get(name) ?? '').trim();
  const race = races.find(([slug]) => slug === field('race'))?.[1];
  const rows: [string, string][] = [
    ['Organisation', field('organisation')],
    ['File', report.fileName],
    ['Runners', `${report.valid} of ${report.totalRows} rows${report.problems.length ? ` (${report.problems.length} skipped)` : ''}`],
    ['Fee recorded', Number(field('feeInr')) > 0 ? `₹${field('feeInr')} each, paid offline` : 'Free (₹0)'],
    ['Race', race ? `${race} where the file has none` : 'From the file'],
    ['T-shirt', field('tshirtSize') ? `${field('tshirtSize')} where the file has none` : 'From the file'],
  ];
  if (field('note')) rows.push(['Note', field('note')]);

  return (
    <div className="importModal" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-confirm-title">
        <button type="button" className="importModalClose" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        <h2 id="import-confirm-title">Import {report.valid} runner{report.valid === 1 ? '' : 's'}?</h2>
        <p>Each runner becomes a <b>paid</b> registration with the next OIRI number and their own ticket.</p>
        <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="importModalWarn">
          <TriangleAlert size={16} /> There is no bulk undo. A wrong import has to be cancelled runner by runner, and their OIRI numbers stay used.
        </p>
        <div className="importActions">
          <button type="button" className="button outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="button" onClick={onConfirm} ref={confirmButton}><Upload size={16} /> Yes, import</button>
        </div>
      </div>
    </div>
  );
}

function ReportPanel({ report }: { report: Report }) {
  const checking = report.mode === 'check';
  return (
    <section className="adminPanel">
      <h2>{checking ? `Checked ${report.fileName}` : `Imported ${report.fileName}`}</h2>
      {checking ? (
        <p className={report.valid ? 'adminSaved' : 'adminError'} role="status">
          {report.valid} of {report.totalRows} rows are ready to import
          {report.problems.length > 0 && `; ${report.problems.length} need fixing (listed below) and will be skipped`}. Nothing has been saved yet.
        </p>
      ) : (
        <p className="adminSaved" role="status">
          {report.imported.length} runner{report.imported.length === 1 ? '' : 's'} registered and marked paid.
          {report.alreadyRegistered.length > 0 && ` ${report.alreadyRegistered.length} were already registered and left as they were.`}
          {report.problems.length > 0 && ` ${report.problems.length} rows were skipped (see below).`}
          {' '}{report.organisationId ? <Link href={`/admin/groups/${report.organisationId}`}>Open the group to download tickets</Link> : <Link href="/admin/registrations">See them in Runners</Link>}.
        </p>
      )}
      <p className="adminHint">
        Columns used: {report.columns.found.join(', ')}.{report.columns.ignored.length > 0 && ` Ignored: ${report.columns.ignored.join(', ')}.`}
      </p>

      {checking && report.preview.length > 0 && (
        <Table title={`First ${report.preview.length} valid rows`} head={['Row', 'Runner', 'Race', 'T-shirt', 'Date of birth', 'Mobile']}
          rows={report.preview.map((row) => [row.row, row.name, row.race, row.tshirtSize, row.dateOfBirth, row.mobile])} />
      )}
      {report.problems.length > 0 && (
        <Table title="Rows to fix" tone="alert" head={['Row', 'Runner', 'Problem']} rows={report.problems.map((row) => [row.row, row.name, row.message])} />
      )}
      {report.alreadyRegistered.length > 0 && (
        <Table title="Already registered" head={['Row', 'Runner', 'Details']} rows={report.alreadyRegistered.map((row) => [row.row, row.name, row.message])} />
      )}
      {report.imported.length > 0 && (
        <Table title="Registered" head={['Row', 'Reg. no.', 'Runner', 'Race', 'Ticket']}
          rows={report.imported.map((row) => [row.row, row.regNo, row.name, row.race, <a key="ticket" href={`/ticket/${row.ticketId}`} target="_blank" rel="noopener">Open</a>])} />
      )}
    </section>
  );
}

function Table({ title, head, rows, tone }: { title: string; head: string[]; rows: React.ReactNode[][]; tone?: 'alert' }) {
  return (
    <div className={tone === 'alert' ? 'importTable alert' : 'importTable'}>
      <h3>{title} ({rows.length})</h3>
      <div className="adminTableWrap">
        <table className="adminTable">
          <thead><tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
          <tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
