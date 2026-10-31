export type RaceSlug = '3km' | '5km' | '10km';

export interface Race {
  slug: RaceSlug;
  distance: string;
  label: string;
}

const races: Race[] = [
  { slug: '3km', distance: '3 KM', label: 'A joyful first stride' },
  { slug: '5km', distance: '5 KM', label: 'Find your city rhythm' },
  { slug: '10km', distance: '10 KM', label: 'Own the long stretch' },
];

const fee = 1; // TEMP: live payment test, restore to 200

// Race day as 'YYYY-MM-DD' once it is fixed. Until then, ages are checked against the first
// expo day, which is never later than race day, so nobody under the minimum age slips through.
const raceDate = '2026-11-29' as string | null;
const expoStartDate = '2026-11-27';
const expoEndDate = '2026-11-28';
// Kit collection hours on both expo days, e.g. '10 AM – 8 PM'. Null shows "Timings to be announced".
const kitCollectionHours = null as string | null;

// When online registration closes, with the India time zone, e.g. '2026-11-20T23:59:00+05:30'.
// Null keeps it open. Payments already in progress are still confirmed after this.
const registrationClosesAt = null as string | null;

export const formatFee = (amount = fee) => `₹${amount}`;

export const event = {
  name: 'ONE INDORE RUN INDORE',
  edition: '2.0',
  raceDate,
  registrationClosesAt,
  fee,
  minAge: 12,
  contact: { phone: '9826681460', email: 'info@oneindorerunindore.com' },
  expoDates: '27 & 28 November 2026',
  expoDays: [expoStartDate, expoEndDate] as const,
  kitCollectionHours,
  races,
  tshirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  kit: ['T-Shirt', 'String Bag', 'Cap', 'Bottle', 'Wrist Sweat Band', 'Bib — 3K / 5K / 10K', '4 Safety Pins', 'Instruction Leaflet', 'Sponsor Discount Coupons'],
  rewards: ['Finisher Medal', 'Finisher Certificate', 'Refreshment Kit', 'Photo Booth Access'],
  faqs: [
    ['What is the registration fee?', `The registration fee is ${formatFee()} for the 3 KM, 5 KM and 10 KM runs.`],
    ['What are the available race categories?', 'Participants can choose from 3 KM, 5 KM and 10 KM.'],
    ['What is the minimum age for registration?', 'Participants must be at least 12 years old as on Race Day.'],
    ['Can minors participate?', 'Yes. Participants below 18 years must be accompanied by a parent or legal guardian.'],
    ['When can I collect my participation kit?', 'Participation kits will be distributed during the Expo on 27 and 28 November 2026.'],
    ['What is included in the participation kit?', 'T-Shirt, String Bag, Cap, Bottle, Wrist Sweat Band, Bib, 4 Safety Pins, Instruction Leaflet and Sponsor Discount Coupons.'],
    ['What do I receive after completing the run?', 'Finishers receive a Finisher Medal, Finisher Certificate, Refreshment Kit and Photo Booth Access.'],
    ['What T-shirt sizes are available?', 'XS, S, M, L, XL and XXL.'],
  ] as [string, string][],
};

export const findRace = (slug: string | undefined) => races.find((race) => race.slug === slug);

/** The date runners' ages are measured on: race day if announced, otherwise the first expo day. */
export const ageReferenceDate = () => raceDate ?? expoStartDate;

const parseDate = (iso: string) => iso.split('-').map(Number) as [number, number, number];

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = parseDate(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole years between a date of birth and another date (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, onDate: string) {
  const [by, bm, bd] = parseDate(dateOfBirth);
  const [y, m, d] = parseDate(onDate);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Formats YYYY-MM-DD with custom parts, e.g. { weekday: 'long' } gives "Sunday", independent of the viewer's time zone. */
export function formatDateParts(iso: string, options: Intl.DateTimeFormatOptions) {
  const [y, m, d] = parseDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { ...options, timeZone: 'UTC' });
}

/** Formats YYYY-MM-DD as e.g. "29 November 2026", independent of the viewer's time zone. */
export function formatDate(iso: string) {
  const [y, m, d] = parseDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
