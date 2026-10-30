'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password input with a button that shows or hides what was typed. */
export function PasswordField() {
  const [visible, setVisible] = useState(false);
  return (
    <span className="adminPassword">
      <input type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="••••••••••••" required maxLength={200} />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
