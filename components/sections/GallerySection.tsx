import Image from 'next/image';
import { photos } from './content';

// Additional photos flow into the grid after the featured six-tile composition.
const galleryPhotos = photos.slice(4);

export function GallerySection() {
  return (
    <section id="gallery" className="gallery galleryMosaic">
      <div className="galleryHeading wrap">
        <p className="eyebrow dark">A city in motion</p>
        <h2>THE <em>ENERGY</em><br />OF SHOWING UP.</h2>
      </div>
      <div className="mosaicGrid">
        {galleryPhotos.map((photo, index) => (
          <figure className="mosaicCard" key={photo}>
            <Image src={photo} width={1000} height={800} alt={`One Indore Run event moment ${index + 1}`} loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  );
}
