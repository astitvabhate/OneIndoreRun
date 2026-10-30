import { db, ticketColumns, uuidPattern, type TicketRow } from './db';

// Organisations ("Groups" in the dashboard): schools, companies and clubs whose runners were
// imported together from a CSV. They often pay a reduced fee or nothing, and their kits may be
// delivered to them before the expo.

export interface OrganisationSummary {
  id: string;
  name: string;
  contact_name: string | null;
  contact_mobile: string | null;
  created_at: string;
  runners: number;
  kits: number;
  amount_paise: number;
}

const summaries = () => db().from('organisation_summary');
const summaryColumns = 'id, name, contact_name, contact_mobile, created_at, runners, kits, amount_paise';

/** Every organisation, newest first, optionally only those whose name contains the search text. */
export async function listOrganisations(search: string) {
  let query = summaries().select(summaryColumns).order('created_at', { ascending: false }).limit(500);
  const text = search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  if (text) query = query.ilike('name', `%${text}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as OrganisationSummary[];
}

export async function getOrganisation(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await summaries().select(summaryColumns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as OrganisationSummary | null;
}

/** The organisation with this name (any capitalisation), created if new. Contact details are updated when given. */
export async function saveOrganisation(name: string, contactName: string, contactMobile: string): Promise<string> {
  const contact = { ...(contactName && { contact_name: contactName }), ...(contactMobile && { contact_mobile: contactMobile }) };
  // The database reads * (and % _) in a pattern as wildcards, so take the candidates and compare exactly here.
  const find = async () => {
    const { data, error } = await db().from('organisations').select('id, name').ilike('name', name.replace(/[\\%_*]/g, '_')).limit(50);
    if (error) throw error;
    return data.find((row) => row.name.toLowerCase() === name.toLowerCase())?.id as string | undefined;
  };

  const existing = await find();
  if (existing) {
    if (Object.keys(contact).length) await db().from('organisations').update(contact).eq('id', existing);
    return existing;
  }
  const { data, error } = await db().from('organisations').insert({ name, ...contact }).select('id').single();
  if (!error) return data.id;
  const raced = error.code === '23505' ? await find() : undefined; // created by a parallel import just now
  if (raced) return raced;
  throw error;
}

// Tickets per PDF download. Hosting caps a response at about 4.5 MB, so bigger groups get several files.
export const ticketsPerPdf = 200;

/** One batch (part 1, 2, …) of an organisation's paid runners' tickets, in number order, for the bulk PDF. */
export async function organisationTickets(id: string, part: number) {
  const from = (part - 1) * ticketsPerPdf;
  const { data, error } = await db()
    .from('registration_details')
    .select(ticketColumns)
    .eq('organisation_id', id)
    .eq('status', 'paid')
    .order('reg_no')
    .range(from, from + ticketsPerPdf - 1);
  if (error) throw error;
  return data as unknown as TicketRow[];
}

/** Marks every paid runner's kit collected (kits sent to the organisation). Returns how many were marked. */
export async function collectOrganisationKits(id: string, by: string) {
  const { data, error } = await db().rpc('collect_organisation_kits', { p_organisation: id, p_by: by });
  if (error) throw error;
  return data as number;
}
