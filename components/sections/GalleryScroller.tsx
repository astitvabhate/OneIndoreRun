'use client';

import { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/** Horizontal photo track with arrow controls for mouse users; touch users can swipe. */
export function GalleryScroller({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <>
      <div className="galleryTrack" ref={track}>{children}</div>
      <div className="galleryControls wrap">
        <button type="button" onClick={() => scroll(-1)} aria-label="Previous photos"><ArrowLeft size={20} /></button>
        <button type="button" onClick={() => scroll(1)} aria-label="Next photos"><ArrowRight size={20} /></button>
      </div>
    </>
  );
}
