import { Plus } from 'lucide-react';
import { event } from '../../lib/eventData';

// Native <details> handles open/close and keyboard access without any client JavaScript.
export function FaqSection() {
  return (
    <section id="faq" className="faq wrap">
      <p className="eyebrow dark">Need to know</p>
      <h2>RUNNER<br /><em>FAQS.</em></h2>
      <div className="faqList">
        {event.faqs.map(([question, answer]) => (
          <details key={question} className="faqItem">
            <summary>{question}<Plus aria-hidden="true" /></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
