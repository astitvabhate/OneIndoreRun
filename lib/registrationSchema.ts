import { z } from 'zod';
import { event } from './eventData';

// Shared by the form (instant feedback) and the API (the check that actually counts).
const mobilePattern = /^[6-9]\d{9}$/;
const mobile = (message: string) => z.string().trim().regex(mobilePattern, message);
const optionalText = z.string().trim().max(200).optional();

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
    age: z.coerce
      .number({ invalid_type_error: 'Please enter your age.' })
      .int('Please enter your age in whole years.')
      .min(event.minAge, `Participants must be at least ${event.minAge} years old on Race Day.`)
      .max(100, 'Please enter a valid age.'),
    gender: z.string().min(1, 'Please select a gender.').max(20),
    bloodGroup: optionalText,
    occupation: optionalText,
    occupationOther: optionalText,
    category: z.enum(['3km', '5km', '10km'], { message: 'Please select a race category.' }),
    tshirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'], { message: 'Please select a T-shirt size.' }),
    guardianName: optionalText,
    guardianMobile: optionalText,
    emergencyName: z.string().trim().min(2, 'Please enter emergency contact name.').max(80),
    emergencyMobile: mobile('Please enter a valid emergency mobile number.'),
    consentRisk: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
    consentRules: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
    consentMedia: z.literal(true, { errorMap: () => ({ message: 'Please accept this acknowledgement.' }) }),
  })
  .superRefine((data, ctx) => {
    if (data.occupation === 'Other' && !data.occupationOther) {
      ctx.addIssue({ code: 'custom', path: ['occupationOther'], message: 'Please tell us your occupation.' });
    }
    if (data.age < 18) {
      if (!data.guardianName || data.guardianName.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Participants under 18 need a parent or guardian.' });
      }
      if (!mobilePattern.test(data.guardianMobile ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['guardianMobile'], message: "Please enter the guardian's 10-digit mobile number." });
      }
    }
    if (data.emergencyMobile === data.mobile) {
      ctx.addIssue({ code: 'custom', path: ['emergencyMobile'], message: 'Please use a different number from your own.' });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Human-friendly registration number shown to runners, e.g. OIR-00042. */
export const formatRegNo = (regNo: number) => `OIR-${String(regNo).padStart(5, '0')}`;
