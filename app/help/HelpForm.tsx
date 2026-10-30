'use client';

import { useActionState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { reportIssue } from './actions';

export function HelpForm({ categories }: { categories: [string, string][] }) {
  const [state, action, pending] = useActionState(reportIssue, undefined);
  const value = (field: string) => state?.values?.[field] ?? '';
  const error = (field: string) => state?.errors?.[field] && <small className="helpFieldError">{state.errors[field]}</small>;

  if (state?.sent) {
    return (
      <div className="helpDone" role="status">
        <CheckCircle2 size={28} />
        <h2>We&apos;ve got it.</h2>
        <p>An organiser will look into it and call or message you on the mobile number you gave. You don&apos;t need to send it again.</p>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="findForm helpForm" noValidate>
        <label>
          What is it about?
          <select name="category" defaultValue={value('category')} required aria-invalid={!!state?.errors?.category}>
            <option value="" disabled>Choose one</option>
            {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {error('category')}
        </label>
        <label>
          Your name
          <input name="name" defaultValue={value('name')} autoComplete="name" maxLength={80} required aria-invalid={!!state?.errors?.name} />
          {error('name')}
        </label>
        <label>
          Mobile number
          <input name="mobile" defaultValue={value('mobile')} type="tel" inputMode="numeric" maxLength={14} autoComplete="tel-national" required aria-invalid={!!state?.errors?.mobile} />
          {error('mobile')}
        </label>
        <label>
          Email <span className="helpOptional">optional</span>
          <input name="email" defaultValue={value('email')} type="email" autoComplete="email" maxLength={120} aria-invalid={!!state?.errors?.email} />
          {error('email')}
        </label>
        <div className="helpPair">
          <label>
            Registration no. <span className="helpOptional">if you have one</span>
            <input name="regNo" defaultValue={value('regNo')} placeholder="OIRI-00012" maxLength={20} autoCapitalize="characters" />
          </label>
          <label>
            Payment ID <span className="helpOptional">if you paid</span>
            <input name="paymentRef" defaultValue={value('paymentRef')} placeholder="pay_… or UPI ref." maxLength={60} />
          </label>
        </div>
        <label>
          What happened?
          <textarea name="message" defaultValue={value('message')} rows={5} maxLength={2000} required placeholder="e.g. Money was taken from my account but I didn't get a ticket." aria-invalid={!!state?.errors?.message} />
          {error('message')}
        </label>
        {/* Hidden from people; bots fill it in. */}
        <input name="website" tabIndex={-1} autoComplete="off" className="helpTrap" aria-hidden="true" />
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Sending…' : <><Send size={17} /> Send to the organisers</>}
        </button>
      </form>
      {state?.message && <p className="findError" role="alert">{state.message}</p>}
    </>
  );
}
