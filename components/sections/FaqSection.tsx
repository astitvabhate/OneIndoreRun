'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { event } from '../../lib/eventData';

export function FaqSection() {
  return <section id="faq" className="faq wrap"><p className="eyebrow dark">Need to know</p><h2>RUNNER<br /><em>FAQS.</em></h2>{event.faqs.map(([question, answer]) => <Faq key={question} question={question} answer={answer} />)}</section>;
}

function Faq({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return <article className="faqItem"><button onClick={() => setOpen(!open)} aria-expanded={open}>{question}<ChevronDown className={open ? 'rotate' : ''} /></button>{open && <p>{answer}</p>}</article>;
}
