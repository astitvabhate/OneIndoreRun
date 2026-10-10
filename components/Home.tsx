import { Navbar } from './Navbar';
import { AboutSection } from './sections/AboutSection';
import { ExpoSection } from './sections/ExpoSection';
import { FaqSection } from './sections/FaqSection';
import { FinalCallToAction } from './sections/FinalCallToAction';
import { FinisherSection } from './sections/FinisherSection';
import { Footer } from './sections/Footer';
import { GallerySection } from './sections/GallerySection';
import { HeroSection } from './sections/HeroSection';
import { IndoreSection } from './sections/IndoreSection';
import { KitSection } from './sections/KitSection';
import { RaceDayBar } from './sections/RaceDayBar';
import { RaceSection } from './sections/RaceSection';
import { RouteSection } from './sections/RouteSection';
import { WhyRunSection } from './sections/WhyRunSection';

// The home page only composes sections; each section owns its markup and behavior.
export function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <RaceDayBar />
        <AboutSection />
        <WhyRunSection />
        <RaceSection />
        <KitSection />
        <ExpoSection />
        <FinisherSection />
        <RouteSection />
        <IndoreSection />
        <GallerySection />
        <FaqSection />
        <FinalCallToAction />
      </main>
      <Footer />
    </>
  );
}
