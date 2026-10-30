'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Download, Info, LoaderCircle, PartyPopper, PencilLine, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { ageReferenceDate, event, findRace, formatDate, formatDateParts, formatFee, type RaceSlug } from '../lib/eventData';
import { openCheckout, postJson, verifyPayment, type CheckoutOrder, type VerifiedPayment } from '../lib/payment';
import { ageOnRaceDay, crossFieldIssues, registrationSchema, type RegistrationInput } from '../lib/registrationSchema';

type Form = RegistrationInput;
type Field = keyof Form;
type Stage = 'form' | 'review' | 'notOpen' | 'done';
type Confirmation = VerifiedPayment;
type CheckoutError = { message: string; ticketId?: string };
/** What the full-screen loader says while checkout is busy outside the Razorpay window. */
type Busy = 'starting' | 'confirming' | 'checking';

const steps = [
  ['participant', 'Participant'],
  ['run', 'Run'],
  ['tshirt', 'T-shirt'],
  ['emergency', 'Emergency'],
  ['consent', 'Consent'],
] as const;

// What each step checks before moving on to the next one (same order as `steps`).
const stepFields: Field[][] = [
  ['firstName', 'middleName', 'lastName', 'mobile', 'email', 'city', 'address', 'pincode', 'dateOfBirth', 'gender', 'bloodGroup', 'occupation', 'occupationOther'],
  ['category'],
  ['tshirtSize'],
  ['emergencyName', 'emergencyMobile'],
  ['consentRisk', 'consentRules', 'consentMedia'],
];

const consents: [Field, string][] = [
  ['consentRisk', 'I understand that I am participating in this event at my own risk. The organizers are not responsible for any injury or loss.'],
  ['consentRules', 'I agree to follow the event rules and safety instructions.'],
  ['consentMedia', 'I consent to use of my photos/videos for promotional purposes.'],
];

export function Registration({ initialCategory }: { initialCategory?: RaceSlug }) {
  const [stage, setStage] = useState<Stage>('form');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutError>();
  const setPaymentError = (error: CheckoutError) => {
    setCheckoutError(error);
    // The message shows at the very top of the page, above the banner.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState<Busy>();
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, trigger, setError, control, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { category: initialCategory },
  });

  const dateOfBirth = useWatch({ control, name: 'dateOfBirth' });
  const occupation = useWatch({ control, name: 'occupation' });
  const age = ageOnRaceDay(dateOfBirth ?? '');
  const isMinor = age >= event.minAge && age < 18;

  const goTo = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showStep = (index: number) => {
    setStage('form');
    setStep(index);
    // Waits a frame so the form is visible again when coming back from the summary.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Cross-field checks (e.g. emergency number same as your own) only run on the full form,
  // so the final check can still fail on an earlier step: open the first one with an error.
  const showFirstError = (formErrors: FieldErrors<Form>) => {
    const index = stepFields.findIndex((fields) => fields.some((name) => formErrors[name]));
    if (index >= 0) showStep(index);
  };

  const toSummary = handleSubmit(() => goTo('review'), showFirstError);

  const nextStep = async () => {
    if (!(await trigger(stepFields[step], { shouldFocus: true }))) return;
    const issues = crossFieldIssues(getValues()).filter(([name]) => stepFields[step].includes(name));
    if (issues.length) {
      issues.forEach(([name, message], index) => setError(name, { type: 'custom', message }, { shouldFocus: index === 0 }));
      return;
    }
    if (step === steps.length - 1) return toSummary();
    showStep(step + 1);
  };

  const onSubmit = (formEvent: React.FormEvent<HTMLFormElement>) => {
    // Enter moves to the next step rather than validating steps not yet shown.
    formEvent.preventDefault();
    void nextStep();
  };
  const current = (index: number) => (index === step ? 'current' : undefined);

  const confirm = async () => {
    setSubmitting(true);
    setCheckoutError(undefined);
    setBusy('starting');
    try {
      const values = getValues();
      const response = await postJson('/api/register', values);
      const body = await response.json().catch(() => ({}));
      if (body.error === 'not_open') return goTo('notOpen');
      if (!response.ok) {
        return setPaymentError({ message: body.message ?? 'We could not start your registration. Please try again in a moment.', ticketId: body.ticketId });
      }

      const name = [values.firstName, values.lastName].join(' ');
      setBusy(undefined); // Razorpay shows its own window from here
      const result = await openCheckout(body as CheckoutOrder, { name, email: values.email, contact: values.mobile });
      if (result.status !== 'paid') {
        // A short pause so the runner sees the window closed for a reason, not a sudden jump.
        setBusy('checking');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (result.status === 'dismissed') {
          return setPaymentError({ message: "Payment not completed. You closed the payment window before paying, so no money was taken and your spot isn't booked yet. Tap Proceed to payment when you're ready." });
        }
        return setPaymentError({ message: `${result.reason.replace(/[.!]?$/, '.')} No money was taken. Please try again, or use a different UPI app, card or bank.` });
      }

      setBusy('confirming');
      const verified = await verifyPayment(result.response);
      if (verified.status === 'rejected') return setPaymentError({ message: verified.message });
      if (verified.status === 'unconfirmed') {
        return setPaymentError({
          message: `Your payment went through (ID ${result.response.razorpay_payment_id}) but we could not confirm it here yet. Please don't pay again: in a few minutes, use "Find my ticket" with your mobile number and date of birth. Keep this ID in case you need to contact the organisers on ${event.contact.phone} or ${event.contact.email}.`,
        });
      }
      setConfirmation(verified.payment);
      goTo('done');
    } catch {
      setPaymentError({ message: 'Something went wrong. Please check your internet connection and try again.' });
    } finally {
      setSubmitting(false);
      setBusy(undefined);
    }
  };

  return (
    <main className="reg">
      <header className="regNav">
        <Logo />
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <PaymentError error={checkoutError} />
      {stage === 'done' && confirmation && (
        <p className="payAlert success" role="status">Payment successful.<br />Your registration {confirmation.regNo} is confirmed.</p>
      )}
      {/* Green once payment is confirmed, red when it didn't go through. */}
      <section className={`regHero${stage === 'done' ? ' paid' : checkoutError ? ' unpaid' : ''}`}>
        <p className="eyebrow dark">One Indore Run Indore 2.0</p>
        <h1>SECURE YOUR<br /><em>SPOT.</em></h1>
        <p className="findTicketLink">Already registered? <Link href="/ticket/find">Find your ticket</Link></p>
      </section>

      {/* The sidebar recap sits beside the form and the summary; the payment result takes the full column. */}
      <div className={`regLayout${stage === 'form' || stage === 'review' ? '' : ' single'}`}>
        <form ref={formRef} onSubmit={onSubmit} className="formFields" noValidate hidden={stage !== 'form'}>
          <div className="stepBar" role="progressbar" aria-label="Registration progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
            <span>Step {step + 1} of {steps.length}</span>
            <i><b style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></i>
          </div>
          <section id="participant" className={current(0)}>
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
              <TextField name="dateOfBirth" label="Date of birth" type="date" min="1920-01-01" max={today()} autoComplete="bday" hint={ageHint(age)} register={register} errors={errors} />
              <SelectField name="gender" label="Gender" placeholder="Select" options={['Male', 'Female', 'Other']} register={register} errors={errors} />
              <SelectField name="bloodGroup" label="Blood group" placeholder="Select (optional)" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} register={register} errors={errors} />
              <SelectField name="occupation" label="Occupation" placeholder="Select (optional)" options={['Student', 'Business', 'Service', 'Retired', 'Other']} register={register} errors={errors} />
              {occupation === 'Other' && <TextField name="occupationOther" label="Your occupation" register={register} errors={errors} />}
            </div>
          </section>

          <section id="run" className={current(1)}>
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

          <section id="tshirt" className={current(2)}>
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

          <section id="emergency" className={current(3)}>
            <p className="eyebrow dark">04 / Emergency</p>
            <h2>EMERGENCY CONTACT.</h2>
            <p className="formIntro">Someone we can reach on race day who isn&apos;t running with you.</p>
            <div className="formGrid">
              <TextField name="emergencyName" label="Full name" autoComplete="off" register={register} errors={errors} />
              <TextField name="emergencyMobile" label="Mobile number" type="tel" inputMode="numeric" maxLength={10} autoComplete="off" register={register} errors={errors} />
            </div>
            {isMinor && (
              <p className="guardian guardianNote"><Info size={16} /> Participants under 18 must be accompanied by a parent or legal guardian on race day.</p>
            )}
          </section>

          <section id="consent" className={current(4)}>
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

          <div className="stepNav">
            {step > 0 && <button type="button" className="button outline" onClick={() => showStep(step - 1)} aria-label="Previous step"><ArrowLeft size={17} /></button>}
            <button type="button" className="button" onClick={nextStep}>
              {step === steps.length - 1 ? 'Continue' : 'Next'} <ArrowRight size={17} />
            </button>
          </div>
        </form>

        {stage === 'review' && <RunSummary values={getValues()} onEdit={showStep} onConfirm={confirm} submitting={submitting} />}
        {stage === 'notOpen' && <NotOpen onEdit={() => goTo('form')} />}
        {stage === 'done' && confirmation && <Done confirmation={confirmation} />}

        {(stage === 'form' || stage === 'review') && <Summary control={control} />}
      </div>
      {busy && <PaymentLoader busy={busy} />}
    </main>
  );
}

const today = () => new Date().toISOString().slice(0, 10);


/** Tells runners which age counts, since race day may not be announced yet. */
function ageHint(age: number) {
  if (Number.isNaN(age)) return event.raceDate ? `We use your age on race day, ${formatDate(event.raceDate)}.` : `Race day is yet to be announced; we use your age on ${formatDate(ageReferenceDate())}.`;
  return event.raceDate ? `You'll be ${age} on race day.` : `You'll be ${age} on ${formatDate(ageReferenceDate())} (race day to be announced).`;
}

type FieldProps = { name: Field; label: string; register: UseFormRegister<Form>; errors: FieldErrors<Form> };

function TextField({ name, label, wide, hint, register, errors, ...input }: FieldProps & { wide?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const message = errors[name]?.message;
  return (
    <label className={wide ? 'wide' : undefined}>
      {label}
      <input type="text" aria-invalid={!!message} {...input} {...register(name)} />
      {hint && !message && <small className="fieldHint">{hint}</small>}
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
      <p className="pending"><ShieldCheck size={14} /> Secure payment by Razorpay: UPI, cards and netbanking.</p>
    </aside>
  );
}

type SummaryRow = [string, React.ReactNode];

/** The runner's answers grouped by the form step that collects them, so the summary can link back to each. */
function summaryGroups(values: Form): [string, number, SummaryRow[]][] {
  const name = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ');
  return [
    ['Your details', 0, [
      ['Name', name],
      ['Mobile', values.mobile],
      ['Email', values.email],
      ['Address', `${values.address}, ${values.city} – ${values.pincode}`],
      ['Date of birth', `${formatDate(values.dateOfBirth)} (age ${ageOnRaceDay(values.dateOfBirth)} on ${event.raceDate ? 'race day' : formatDate(ageReferenceDate())})`],
      ['Gender', values.gender],
      ['Blood group', values.bloodGroup || '—'],
      ['Occupation', (values.occupation === 'Other' ? values.occupationOther : values.occupation) || '—'],
    ]],
    ['Run & T-shirt', 1, [
      ['Race', findRace(values.category)?.distance],
      ['T-shirt size', values.tshirtSize],
    ]],
    ['Emergency contact', 3, [
      ['Contact', `${values.emergencyName} · ${values.emergencyMobile}`],
    ]],
  ];
}

const [kitStart, kitEnd] = event.expoDays;

/** The last step: everything the runner entered, the event dates and the kit, with an edit link per step. */
function RunSummary({ values, onEdit, onConfirm, submitting }: { values: Form; onEdit: (step: number) => void; onConfirm: () => void; submitting: boolean }) {
  const eventRows: SummaryRow[] = [
    ['Race day', event.raceDate ? formatDate(event.raceDate) : 'To be announced'],
    ['Kit collection', `${formatDateParts(kitStart, { day: 'numeric' })} & ${formatDateParts(kitEnd, { day: 'numeric', month: 'long' })}${event.kitCollectionHours ? ` · ${event.kitCollectionHours}` : ''}`],
    ['Entry fee', formatFee()],
  ];
  return (
    <section className="review runSummary" aria-labelledby="summary-title">
      <p className="eyebrow dark">Registration summary</p>
      <h2 id="summary-title">YOUR RUN.</h2>
      <p className="formIntro">Check your details before paying. Your bib and certificate will use this name.</p>
      {summaryGroups(values).map(([title, step, rows]) => (
        <div className="summaryGroup" key={title}>
          <header>
            <h3>{title}</h3>
            <button type="button" className="editLink" onClick={() => onEdit(step)} disabled={submitting}><PencilLine size={14} /> Edit</button>
          </header>
          <SummaryList rows={rows} />
        </div>
      ))}
      <div className="summaryGroup">
        <header><h3>Event</h3></header>
        <SummaryList rows={eventRows} />
      </div>
      <div className="kitCard">
        <p className="summaryTitle">YOUR PARTICIPATION KIT</p>
        {event.kit.map((item) => <p className="tick" key={item}><Check size={15} />{item}</p>)}
        <p className="summaryTitle">YOUR FINISHER BENEFITS</p>
        {event.rewards.map((item) => <p className="tick" key={item}><Check size={15} />{item}</p>)}
        <p className="pending"><ShieldCheck size={14} /> Secure payment by Razorpay: UPI, cards and netbanking.</p>
      </div>
      <div className="reviewActions">
        <button type="button" className="button" onClick={onConfirm} disabled={submitting}>
          {submitting ? 'Please wait…' : <>Proceed to payment · {formatFee()} <ArrowRight size={17} /></>}
        </button>
      </div>
    </section>
  );
}

function SummaryList({ rows }: { rows: SummaryRow[] }) {
  return <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function PaymentError({ error }: { error?: CheckoutError }) {
  if (!error) return null;
  return (
    <p className="payAlert" role="alert">
      {error.message}
      {error.ticketId && <> <a href={`/ticket/${error.ticketId}`} target="_blank" rel="noopener">Open your ticket</a></>}
    </p>
  );
}

const loaderText: Record<Busy, [string, string]> = {
  starting: ['Opening secure payment…', 'Saving your details and preparing the Razorpay window.'],
  confirming: ['Confirming your payment…', "This can take up to 15 seconds. Please don't close or refresh this page, and don't pay again."],
  checking: ['Checking payment status…', 'One moment while we see what happened.'],
};

function PaymentLoader({ busy }: { busy: Busy }) {
  const [title, text] = loaderText[busy];
  return (
    <div className="paymentLoader" role="status" aria-live="polite">
      <div>
        <LoaderCircle size={42} className="spin" aria-hidden />
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

function NotOpen({ onEdit }: { onEdit: () => void }) {
  return (
    <section className="review notice" role="status">
      <p className="eyebrow dark">Almost there</p>
      <h2>PAYMENT<br />OPENS <em>SOON.</em></h2>
      <p>Online payment for One Indore Run Indore isn&apos;t live yet, so <strong>your registration has not been submitted</strong> and no money has been taken.</p>
      <p>Please come back once registrations open to complete your entry.</p>
      <div className="reviewActions">
        <button type="button" className="button outline" onClick={onEdit}><PencilLine size={16} /> Back to my details</button>
        <Link href="/" className="button">Back to home <ArrowRight size={17} /></Link>
      </div>
    </section>
  );
}

function Done({ confirmation }: { confirmation: Confirmation }) {
  return (
    <section className="review notice done" role="status">
      <p className="eyebrow dark"><PartyPopper size={14} /> Payment received</p>
      <h2>YOU&apos;RE <em>IN.</em></h2>
      <div className="regNumber">
        <span>Registration number</span>
        <b>{confirmation.regNo}</b>
        {confirmation.race && <small>{confirmation.race} run</small>}
      </div>
      {confirmation.duplicatePayment && (
        <p className="paymentError" role="alert">You had already paid for this registration in another window, so this second payment will be refunded. Please share your payment ID with the organisers ({event.contact.phone} or {event.contact.email}) if it isn&apos;t back within 7 days.</p>
      )}
      <p>Download your digital ticket now. Show its QR code with a photo ID at the Race Expo on <strong>{event.expoDates}</strong> to collect your kit and bib.</p>
      <div className="reviewActions">
        <a href={`/api/ticket/${confirmation.ticketId}`} className="button" download><Download size={17} /> Download ticket (PDF)</a>
      </div>
      <p className="ticketTip">Lost it? Use &quot;Find my ticket&quot; with your mobile number and date of birth to download it again.</p>
    </section>
  );
}
