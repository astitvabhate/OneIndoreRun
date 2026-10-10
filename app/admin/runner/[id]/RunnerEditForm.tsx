'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';
import { saveRunner, type EditState } from '../../actions';

export interface RunnerValues {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  city: string;
  address: string;
  pincode: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  occupation: string;
  category: string;
  tshirtSize: string;
  emergencyName: string;
  emergencyMobile: string;
  guardianName: string;
  guardianMobile: string;
  adminNotes: string;
}

type FieldName = Exclude<keyof RunnerValues, 'id'>;

const races = [['3km', '3 KM'], ['5km', '5 KM'], ['10km', '10 KM']];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const bloodGroups = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** The organiser's edit form; errors come back from the server action without a page reload. */
export function RunnerEditForm({ values }: { values: RunnerValues }) {
  const [state, action, saving] = useActionState<EditState, FormData>(saveRunner, undefined);
  const error = (name: FieldName) => state?.errors?.[name]?.[0];

  const text = (name: FieldName, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={error(name) ? 'invalid' : undefined}>
      {label}
      <input name={name} defaultValue={values[name]} {...props} />
      {error(name) && <small>{error(name)}</small>}
    </label>
  );
  const select = (name: FieldName, label: string, options: (string | string[])[]) => (
    <label>
      {label}
      <select name={name} defaultValue={values[name]}>
        {options.map((option) => {
          const [value, title] = Array.isArray(option) ? option : [option, option || '—'];
          return <option key={value} value={value}>{title}</option>;
        })}
      </select>
    </label>
  );

  return (
    <form action={action} className="adminForm">
      <input type="hidden" name="id" value={values.id} />
      <fieldset>
        <legend>Race</legend>
        {select('category', 'Race', races)}
        {select('tshirtSize', 'T-shirt size', sizes)}
      </fieldset>
      <fieldset>
        <legend>Runner</legend>
        {text('firstName', 'First name')}
        {text('middleName', 'Middle name')}
        {text('lastName', 'Last name')}
        {text('dateOfBirth', 'Date of birth', { type: 'date' })}
        {select('gender', 'Gender', ['Male', 'Female', 'Other'])}
        {select('bloodGroup', 'Blood group', bloodGroups)}
        {text('occupation', 'Occupation')}
      </fieldset>
      <fieldset>
        <legend>Contact</legend>
        {text('mobile', 'Mobile', { inputMode: 'numeric', maxLength: 10 })}
        {text('email', 'Email', { type: 'email' })}
        {text('city', 'City')}
        {text('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}
        <span className="wide">{text('address', 'Address')}</span>
      </fieldset>
      <fieldset>
        <legend>Emergency &amp; guardian</legend>
        {text('emergencyName', 'Emergency contact')}
        {text('emergencyMobile', 'Emergency mobile', { inputMode: 'numeric', maxLength: 10 })}
        {text('guardianName', 'Guardian (under 18s)')}
        {text('guardianMobile', 'Guardian mobile', { inputMode: 'numeric', maxLength: 10 })}
      </fieldset>
      <fieldset>
        <legend>Organiser notes</legend>
        <label className="wide">
          Private notes (never shown to the runner)
          <textarea name="adminNotes" defaultValue={values.adminNotes} rows={3} maxLength={1000} />
        </label>
      </fieldset>
      {state?.message && <p className="adminError" role="alert">{state.message}</p>}
      <button className="button" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}
