import type { HistoryAction, HistoryEntry } from '../../lib/server/admin';

export const historyLabels: Record<HistoryAction, string> = {
  edited: 'Details edited',
  cancelled: 'Cancelled',
  restored: 'Restored',
  kit_collected: 'Kit collected',
  kit_undone: 'Kit check-in undone',
  signed_in: 'Signed in',
};

const fieldLabels: Record<string, string> = { race: 'Race', tshirt_size: 'T-shirt', date_of_birth: 'Date of birth', admin_notes: 'Notes' };
const fieldLabel = (key: string) => fieldLabels[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
const shown = (value: unknown) => (value === null || value === undefined || value === '' ? '(empty)' : String(value));

/** The reason for a cancellation, or each changed field as old → new for an edit. */
export function HistoryDetails({ entry }: { entry: HistoryEntry }) {
  const changes = Object.entries(entry.details?.changes ?? {});
  if (entry.details?.reason) return <span className="historyReason">{entry.details.reason}</span>;
  if (changes.length === 0) return null;
  return (
    <ul className="historyChanges">
      {changes.map(([key, { from, to }]) => (
        <li key={key}><b>{fieldLabel(key)}:</b> <del>{shown(from)}</del> → <ins>{shown(to)}</ins></li>
      ))}
    </ul>
  );
}
