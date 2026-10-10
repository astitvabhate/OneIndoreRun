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

const fee = 200;

// Race day as 'YYYY-MM-DD' once it is fixed. Until then, ages are checked against the first
// expo day, which is never later than race day, so nobody under the minimum age slips through.
const raceDate = null as string | null;
const expoStartDate = '2026-11-27';

export const formatFee = (amount = fee) => `₹${amount}`;

export const event = {
  name: 'ONE INDORE RUN',
  edition: 'INDORE 2.0',
  raceDate,
  fee,
  minAge: 12,
  expoDates: '27 & 28 November 2026',
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

/** Formats YYYY-MM-DD as e.g. "29 November 2026", independent of the viewer's time zone. */
export function formatDate(iso: string) {
  const [y, m, d] = parseDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
