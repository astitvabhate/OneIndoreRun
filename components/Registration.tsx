'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Info, PencilLine, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { event, findRace, formatFee, type RaceSlug } from '../lib/eventData';
import { paymentService } from '../lib/payment';

const mobile = (message: string) => z.string().trim().regex(/^[6-9]\d{9}$/, message);
const optionalText = z.string().trim().optional();

const schema = z
  .object({
    firstName: z.string().trim().min(2, 'Please enter your first name.'),
    middleName: optionalText,
    lastName: z.string().trim().min(2, 'Please enter your last name.'),
    mobile: mobile('Please enter a valid 10-digit mobile number.'),
    email: z.string().trim().email('Please enter a valid email.'),
    city: z.string().trim().min(2, 'Please enter your city.'),
    address: z.string().trim().min(5, 'Please enter your address.'),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Please enter a valid 6-digit pincode.'),
    age: z.coerce
      .number({ invalid_type_error: 'Please enter your age.' })
      .int('Please enter your age in whole years.')
      .min(event.minAge, `Participants must be at least ${event.minAge} years old on Race Day.`)
      .max(100, 'Please enter a valid age.'),
    gender: z.string().min(1, 'Please select a gender.'),
    bloodGroup: optionalText,
    occupation: optionalText,
    occupationOther: optionalText,
    category: z.enum(['3km', '5km', '10km'], { message: 'Please select a race category.' }),
    tshirtSize: z.string({ invalid_type_error: 'Please select a T-shirt size.' }).min(1, 'Please select a T-shirt size.'),
    guardianName: optionalText,
    guardianMobile: optionalText,
    emergencyName: z.string().trim().min(2, 'Please enter emergency contact name.'),
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
      if (!/^[6-9]\d{9}$/.test(data.guardianMobile ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['guardianMobile'], message: "Please enter the guardian's 10-digit mobile number." });
      }
    }
    if (data.emergencyMobile === data.mobile) {
      ctx.addIssue({ code: 'custom', path: ['emergencyMobile'], message: 'Please use a different number from your own.' });
    }
  });

type Form = z.infer<typeof schema>;
type Field = keyof Form;
type Stage = 'form' | 'review' | 'pending';

const steps = [
  ['participant', 'Participant'],
  ['run', 'Run'],
  ['tshirt', 'T-shirt'],
  ['emergency', 'Emergency'],
  ['consent', 'Consent'],
] as const;

const consents: [Field, string][] = [
  ['consentRisk', 'I understand that I am participating in this event at my own risk. The organizers are not responsible for any injury or loss.'],
  ['consentRules', 'I agree to follow the event rules and safety instructions.'],
  ['consentMedia', 'I consent to use of my photos/videos for promotional purposes.'],
];

export function Registration({ initialCategory }: { initialCategory?: RaceSlug }) {
  const [stage, setStage] = useState<Stage>('form');
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, control, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { category: initialCategory },
  });

  const age = useWatch({ control, name: 'age' });
  const occupation = useWatch({ control, name: 'occupation' });
  const isMinor = Number(age) >= event.minAge && Number(age) < 18;

  const goTo = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirm = async () => {
    setSubmitting(true);
    const status = await paymentService.beginPayment(event.fee, crypto.randomUUID());
    setSubmitting(false);
    if (status === 'pending') goTo('pending');
  };

  return (
    <main className="reg">
      <header className="regNav">
        <Logo />
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <section className="regHero">
        <p className="eyebrow dark">One Indore Run · Indore 2.0</p>
        <h1>SECURE YOUR<br /><em>SPOT.</em></h1>
        <p>Choose your run. Show up. Run Indore.</p>
      </section>

      <nav className="progress" aria-label="Registration steps">
        {steps.map(([id, label], index) => (
          <a key={id} href={stage === 'form' ? `#${id}` : undefined} className={stage === 'form' ? '' : 'done'}>
            <b>{stage === 'form' ? `0${index + 1}` : <Check size={13} />}</b>{label}
          </a>
        ))}
        <span className={stage === 'form' ? '' : 'current'} aria-current={stage === 'form' ? undefined : 'step'}><b>06</b>Review</span>
      </nav>

      <div className="regLayout">
        <form onSubmit={handleSubmit(() => goTo('review'))} className="formFields" noValidate hidden={stage !== 'form'}>
          <section id="participant">
            <p className="eyebrow dark">01 / Participant</p>
            <h2>YOUR DETAILS.</h2>
            <div className="formGrid">
              <TextField name="firstName" label="First name" autoComplete="given-name" register={register} errors={errors} />
              <TextField name="middleName" label="Middle name (optional)" autoComplete="additional-name" register={register} errors={errors} />
              <TextField name="lastName" label="Last name" autoComplete="family-name" register={register} errors={errors} />
              <TextField name="mobile" label="Mobile number" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" register={register} errors={errors} />
              <TextField name="email" label="Email ID" type="email" autoComplete="email" register={register} errors={errors} />
              <TextField name="city" label="City" autoComplete="address-level2" register={register} errors={errors} />
              <TextField name="address" label="Address" autoComplete="street-address" wide register={register} errors={errors} />
              <TextField name="pincode" label="Pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" register={register} errors={errors} />
              <TextField name="age" label="Age on race day" type="number" inputMode="numeric" min={event.minAge} max={100} register={register} errors={errors} />
              <SelectField name="gender" label="Gender" placeholder="Select" options={['Male', 'Female', 'Other']} register={register} errors={errors} />
              <SelectField name="bloodGroup" label="Blood group" placeholder="Select (optional)" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} register={register} errors={errors} />
              <SelectField name="occupation" label="Occupation" placeholder="Select (optional)" options={['Student', 'Business', 'Service', 'Retired', 'Other']} register={register} errors={errors} />
              {occupation === 'Other' && <TextField name="occupationOther" label="Your occupation" register={register} errors={errors} />}
            </div>
          </section>

          <section id="run">
            <p className="eyebrow dark">02 / Run</p>
            <h2>CHOOSE YOUR RUN.</h2>
            <div className="choiceGrid" role="radiogroup" aria-label="Race category">
              {event.races.map((race) => (
                <label className="choice" key={race.slug}>
                  <input type="radio" value={race.slug} {...register('category')} />
                  <span><b>{race.distance}</b><i>{formatFee()}</i></span>
                </label>
              ))}
            </div>
            <FieldError message={errors.category?.message} />
          </section>

          <section id="tshirt">
            <p className="eyebrow dark">03 / T-shirt</p>
            <h2>YOUR SIZE.</h2>
            <div className="sizes" role="radiogroup" aria-label="T-shirt size">
              {event.tshirtSizes.map((size) => (
                <label key={size}>
                  <input type="radio" value={size} {...register('tshirtSize')} />
                  <span>{size}</span>
                </label>
              ))}
            </div>
            <FieldError message={errors.tshirtSize?.message} />
          </section>

          <section id="emergency">
            <p className="eyebrow dark">04 / Emergency</p>
            <h2>EMERGENCY CONTACT.</h2>
            <p className="formIntro">Someone we can reach on race day who isn&apos;t running with you.</p>
            <div className="formGrid">
              <TextField name="emergencyName" label="Full name" autoComplete="off" register={register} errors={errors} />
              <TextField name="emergencyMobile" label="Mobile number" type="tel" inputMode="numeric" maxLength={10} autoComplete="off" register={register} errors={errors} />
            </div>
            {isMinor && (
              <div className="guardian">
                <p className="guardianNote"><Info size={16} /> Participants under 18 must be accompanied by a parent or legal guardian on race day.</p>
                <div className="formGrid">
                  <TextField name="guardianName" label="Parent / guardian name" register={register} errors={errors} />
                  <TextField name="guardianMobile" label="Parent / guardian mobile" type="tel" inputMode="numeric" maxLength={10} register={register} errors={errors} />
                </div>
              </div>
            )}
          </section>

          <section id="consent">
            <p className="eyebrow dark">05 / Consent</p>
            <h2>READY WHEN<br />YOU ARE.</h2>
            <div className="consents">
              {consents.map(([name, text]) => (
                <label key={name} className={errors[name] ? 'invalid' : ''}>
                  <input type="checkbox" {...register(name)} />
                  <span>{text}</span>
                </label>
              ))}
            </div>
            <FieldError message={consents.some(([name]) => errors[name]) ? 'Please accept all three acknowledgements to continue.' : undefined} />
          </section>

          <button className="button formSubmit" type="submit">Review registration <ArrowRight size={17} /></button>
        </form>

        {stage === 'review' && <Review values={getValues()} onEdit={() => goTo('form')} onConfirm={confirm} submitting={submitting} />}
        {stage === 'pending' && <PaymentPending onEdit={() => goTo('form')} />}

        <Summary control={control} />
      </div>
    </main>
  );
}

type FieldProps = { name: Field; label: string; register: UseFormRegister<Form>; errors: FieldErrors<Form> };

function TextField({ name, label, wide, register, errors, ...input }: FieldProps & { wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const message = errors[name]?.message;
  return (
    <label className={wide ? 'wide' : undefined}>
      {label}
      <input type="text" aria-invalid={!!message} {...input} {...register(name)} />
      <FieldError message={message} />
    </label>
  );
}

function SelectField({ name, label, placeholder, options, register, errors }: FieldProps & { placeholder: string; options: string[] }) {
  const message = errors[name]?.message;
  return (
    <label>
      {label}
      <select aria-invalid={!!message} {...register(name)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <FieldError message={message} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="fieldError" role="alert">{message}</small> : null;
}

/** Sidebar summary; subscribes only to the fields it shows so typing elsewhere doesn't re-render it. */
function Summary({ control }: { control: Control<Form> }) {
  const [category, tshirtSize] = useWatch({ control, name: ['category', 'tshirtSize'] });
  return (
    <aside className="summary">
      <p className="eyebrow dark">Registration summary</p>
      <h3>YOUR RUN.</h3>
      <div><span>Category</span><b>{findRace(category)?.distance ?? 'Select a run'}</b></div>
      <div><span>Entry fee</span><b>{formatFee()}</b></div>
      <div><span>T-shirt</span><b>{tshirtSize || '—'}</b></div>
      <hr />
      <p className="summaryTitle">YOUR PARTICIPATION KIT</p>
      {event.kit.map((item) => <p className="tick" key={item}><Check size={15} />{item}</p>)}
      <p className="summaryTitle">YOUR FINISHER BENEFITS</p>
      {event.rewards.map((item) => <p className="tick" key={item}><Check size={15} />{item}</p>)}
      <p className="pending"><ShieldCheck size={14} /> Online payment is not open yet. No payment will be taken.</p>
    </aside>
  );
}

function Review({ values, onEdit, onConfirm, submitting }: { values: Form; onEdit: () => void; onConfirm: () => void; submitting: boolean }) {
  const name = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ');
  const rows: [string, React.ReactNode][] = [
    ['Name', name],
    ['Mobile', values.mobile],
    ['Email', values.email],
    ['Address', `${values.address}, ${values.city} – ${values.pincode}`],
    ['Age', values.age],
    ['Gender', values.gender],
    ['Blood group', values.bloodGroup || '—'],
    ['Occupation', (values.occupation === 'Other' ? values.occupationOther : values.occupation) || '—'],
    ['Race', findRace(values.category)?.distance],
    ['T-shirt size', values.tshirtSize],
    ['Emergency contact', `${values.emergencyName} · ${values.emergencyMobile}`],
  ];
  if (values.guardianName) rows.push(['Parent / guardian', `${values.guardianName} · ${values.guardianMobile}`]);

  return (
    <section className="review" aria-labelledby="review-title">
      <p className="eyebrow dark">06 / Review</p>
      <h2 id="review-title">CHECK YOUR<br />DETAILS.</h2>
      <p className="formIntro">Make sure everything is correct. Your bib and certificate will use this name.</p>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="reviewActions">
        <button type="button" className="button outline" onClick={onEdit}><PencilLine size={16} /> Edit details</button>
        <button type="button" className="button" onClick={onConfirm} disabled={submitting}>
          {submitting ? 'Please wait…' : <>Proceed to payment · {formatFee()} <ArrowRight size={17} /></>}
        </button>
      </div>
    </section>
  );
}

function PaymentPending({ onEdit }: { onEdit: () => void }) {
  return (
    <section className="review notice" role="status">
      <p className="eyebrow dark">Almost there</p>
      <h2>PAYMENT<br />OPENS <em>SOON.</em></h2>
      <p>Online payment for One Indore Run isn&apos;t live yet, so <strong>your registration has not been submitted</strong> and no money has been taken.</p>
      <p>Please come back once registrations open to complete your entry.</p>
      <div className="reviewActions">
        <button type="button" className="button outline" onClick={onEdit}><PencilLine size={16} /> Back to my details</button>
        <Link href="/" className="button">Back to home <ArrowRight size={17} /></Link>
      </div>
    </section>
  );
}
