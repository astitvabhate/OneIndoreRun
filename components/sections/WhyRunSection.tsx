import { benefits } from './content';
import { Reveal } from './Reveal';

export function WhyRunSection() {
  return <section className="why darkSection"><div className="wrap"><Reveal><p className="eyebrow">WHY ONE INDORE RUN?</p><h2>THE CITY<br />IS <em>CALLING.</em></h2></Reveal><div className="benefits">{benefits.map(([number, title, description]) => <Reveal key={number}><article><b>{number}</b><h3>{title}</h3><p>{description}</p></article></Reveal>)}</div></div></section>;
}
