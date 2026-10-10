import { Trophy } from 'lucide-react';
import { event } from '../../lib/eventData';
import { Reveal } from './Reveal';

export function FinisherSection() {
  return <section className="finish darkSection"><div className="wrap"><Reveal><p className="eyebrow">The reward is real</p><h2>EARN YOUR<br /><em>FINISHER.</em></h2></Reveal><div className="finishGrid"><div className="rewardList">{event.rewards.map((reward, index) => <div key={reward}><span>{String(index + 1).padStart(2, '0')}</span><h3>{reward}</h3></div>)}</div><div className="booth"><Trophy /><p>I COMPLETED THE<br /><b>ONE INDORE RUN</b><br />INDORE 2.0</p><small>PHOTO BOOTH MOMENT</small></div></div></div></section>;
}
