import Link from 'next/link';
import { Building2, ChevronRight, FileUp, Search } from 'lucide-react';
import { requireAdmin } from '../../../lib/server/adminAuth';
import { listOrganisations } from '../../../lib/server/organisations';
import { StaffBar } from '../StaffBar';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

export default async function Groups({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireAdmin();
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const groups = await listOrganisations(q);

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Groups" />

      <header className="adminHead">
        <div>
          <p className="adminHeadDate">Organisations</p>
          <h1>Groups</h1>
        </div>
        <div className="adminHeadActions">
          <Link className="button small" href="/admin/import"><FileUp size={15} /> Import runners</Link>
        </div>
      </header>

      <section className="adminPanel">
        <p className="adminHint">Schools, companies and clubs whose runners were imported together. Open one to download all its QR tickets or mark its kits collected.</p>
        <form className="adminFilters groupSearch" method="get">
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={q} placeholder="Search organisations" aria-label="Search organisations" />
          </label>
          <button className="button small" type="submit">Search</button>
          {q && <Link href="/admin/groups" className="adminClear">Clear</Link>}
        </form>

        {groups.length === 0 ? (
          <p className="adminEmpty">{q ? 'No organisation matches.' : 'No groups yet. Import an organisation’s runners to start one.'}</p>
        ) : (
          <ul className="groupList">
            {groups.map((group) => (
              <li key={group.id}>
                <Link href={`/admin/groups/${group.id}`} className="groupCard">
                  <span className="groupCardIcon"><Building2 size={18} /></span>
                  <span className="groupCardMain">
                    <b>{group.name}</b>
                    <small>{group.contact_name ? `${group.contact_name}${group.contact_mobile ? ` · ${group.contact_mobile}` : ''}` : 'No contact person'}</small>
                  </span>
                  <span className="groupCardStats">
                    <span><b>{group.runners}</b> runners</span>
                    <span className={group.runners > 0 && group.kits === group.runners ? 'kitDone' : undefined}><b>{group.kits}/{group.runners}</b> kits</span>
                    <span><b>{rupees(group.amount_paise)}</b> received</span>
                  </span>
                  <ChevronRight className="groupCardArrow" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
