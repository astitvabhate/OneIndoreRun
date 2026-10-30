import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { event, formatFee } from '../../../lib/eventData';
import { requireAdmin } from '../../../lib/server/adminAuth';
import { maxImportRows, templateCsv } from '../../../lib/server/csvImport';
import { getOrganisation, listOrganisations } from '../../../lib/server/organisations';
import { StaffBar } from '../StaffBar';
import { ImportForm } from './ImportForm';

// A big school list takes a while to import: give the server action time to finish.
export const maxDuration = 300;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const staff = await requireAdmin();
  const { group } = await searchParams;
  // Opened from a group's page: add more runners to that organisation.
  const [organisations, current] = await Promise.all([listOrganisations(''), group ? getOrganisation(group) : null]);
  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Import runners" />

      <section className="adminPanel">
        <Link href={current ? `/admin/groups/${current.id}` : '/admin/groups'} className="adminIconLink dark pageBack"><ArrowLeft size={15} /> {current ? current.name : 'Groups'}</Link>
        <h2>Import runners from an organisation</h2>
        <p className="adminHint">
          For group entries such as a school&apos;s students. Every valid row becomes a <b>paid</b> registration with its own OIRI number and ticket,
          recorded as paid offline at whatever the organisation paid per runner (₹0 if nothing). The runners are grouped under the organisation,
          so you can download all their QR tickets and mark their kits collected together from Groups. Runners already registered for that race are skipped, so importing the same file twice is safe.
          Up to {maxImportRows.toLocaleString('en-IN')} rows per file.
        </p>
        <ul className="importColumns">
          <li><b>Required columns:</b> First name + Last name (or one Name column with the full name), Date of birth, Gender.</li>
          <li><b>Optional columns:</b> Mobile, Email, Race, T-shirt, Guardian name, Guardian mobile, Emergency name, Emergency mobile, City, Address, Pincode, Blood group, Occupation. Other columns (class, roll no.) are ignored.</li>
          <li>Dates can be 15/08/2012 (day first), 2012-08-15 or 15-Aug-2012. Race can be 3, 5 or 10 (or &quot;5 KM&quot;). Empty cells use the defaults below.</li>
        </ul>
        <a className="adminIconLink dark" download="one-indore-run-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}>
          <Download size={15} /> Download a sample CSV
        </a>
      </section>

      <ImportForm
        races={event.races.map((race) => [race.slug, race.distance])} sizes={event.tshirtSizes} feeLabel={formatFee()}
        organisations={organisations.map((organisation) => organisation.name)} organisation={current?.name ?? ''}
      />
    </main>
  );
}
