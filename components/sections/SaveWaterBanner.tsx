import { Droplet } from 'lucide-react';

const message = 'Run for the city, Save water for its future.';
// Enough copies to fill a wide screen; the track holds two such runs and slides by one.
const run = Array.from({ length: 8 }, (_, i) => <span key={i}><Droplet />{message}</span>);

// A scrolling save-water strip between the hero and the race bar.
export function SaveWaterBanner() {
  return (
    <aside className="saveWater" aria-label={message}>
      <div className="saveWaterTrack" aria-hidden="true">
        <div>{run}</div>
        <div>{run}</div>
      </div>
    </aside>
  );
}
