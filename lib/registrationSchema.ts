import { z } from 'zod';
import { ageOn, ageReferenceDate, event, formatDate, isValidDate } from './eventData';

// Shared by the form (instant feedback) and the API (the check that actually counts).
const mobilePattern = /^[6-9]\d{9}$/;
const mobile = (message: string) => z.string().trim().regex(mobilePattern, message);
const optionalText = z.string().trim().max(200).optional();
/** Age on race day (or the fallback date); NaN for an invalid date so range checks skip it. */
export const ageOnRaceDay = (dateOfBirth: string) => (isValidDate(dateOfBirth) ? ageOn(dateOfBirth, ageReferenceDate()) : NaN);
const ageDeadline = event.raceDate ? 'race day' : formatDate(ageReferenceDate());

export const registrationSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Please enter your first name.').max(60),
    middleName: optionalText,
    lastName: z.string().trim().min(2, 'Please enter your last name.').max(60),
    mobile: mobile('Please enter a valid 10-digit mobile number.'),
    email: z.string().trim().toLowerCase().email('Please enter a valid email.').max(120),
    city: z.string().trim().min(2, 'Please enter your city.').max(80),
    address: z.string().trim().min(5, 'Please enter your address.').max(300),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Please enter a valid 6-digit pincode.'),
    dateOfBirth: z
      .string({ invalid_type_error: 'Please enter your date of birth.' })
      .refine(isValidDate, 'Please enter your date of birth.')
      .refine((dob) => !(ageOnRaceDay(dob) < event.minAge), `Participants must be at least ${event.minAge} years old on ${ageDeadline}.`)
      .refine((dob) => !(ageOnRaceDay(dob) > 100), 'Please check your date of birth.'),
    gender: z.string().min(1, 'Please select a gender.').max(20),
    bloodGroup: optionalText,
    occupation: optionalText,
    occupationOther: optionalText,
    category: z.enum(['3km', '5km', '10km'], { message: 'Please select a race category.' }),
    tshirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'], { message: 'Please select a T-shirt size.' }),
    // No longer asked for (the emergency contact covers under-18s); still accepted if sent.
    guardianName: optionalText,
    guardianMobile: optionalText,
    emergencyName: z.string().trim().min(2, 'Please enter emergency contact name.').max(80),
    emergencyMobile: mobile('Please enter a valid emergency mobile number.'),
    consentRisk: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
    consentRules: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
    consentMedia: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
  })
  .superRefine((data, ctx) => {
    for (const [path, message] of crossFieldIssues(data)) ctx.addIssue({ code: 'custom', path: [path], message });
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/**
 * Rules that compare two fields. Zod only runs them once every field is valid, so the form also
 * calls this directly at the step that owns each field instead of waiting for the final submit.
 */
export function crossFieldIssues(data: Partial<RegistrationInput>): [keyof RegistrationInput, string][] {
  const issues: [keyof RegistrationInput, string][] = [];
  if (data.occupation === 'Other' && !data.occupationOther?.trim()) issues.push(['occupationOther', 'Please tell us your occupation.']);
  if (data.emergencyMobile?.trim() && data.emergencyMobile.trim() === data.mobile?.trim()) {
    issues.push(['emergencyMobile', 'Please use a different number from your own.']);
  }
  return issues;
}

/** Human-friendly registration number shown to runners, e.g. OIRI-00042. */
export const formatRegNo = (regNo: number) => `OIRI-${String(regNo).padStart(5, '0')}`;
