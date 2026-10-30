import Image from 'next/image';
import { photos } from './content';
import { GalleryScroller } from './GalleryScroller';

const galleryPhotos = photos.slice(4);

export function GallerySection() {
  return (
    <section id="gallery" className="gallery">
      <div className="galleryHeading wrap">
        <p className="eyebrow dark">A city in motion</p>
        <h2>THE <em>ENERGY</em><br />OF SHOWING UP.</h2>
      </div>
      <GalleryScroller>
        {galleryPhotos.map((photo, index) => (
          <figure className="galleryCard" key={photo}>
            <Image src={photo} width={1000} height={800} sizes="(max-width: 750px) 82vw, 36vw" alt={`One Indore Run Indore event moment ${index + 1}`} />
          </figure>
        ))}
      </GalleryScroller>
    </section>
  );
}
