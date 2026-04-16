import Navbar from '@/components/layout/navbar';
import { AboutHero } from '@/components/about/about-hero';
import { MissionVision } from '@/components/about/mission-vision';
import { AboutTimeline } from '@/components/about/about-timeline';
import { TeamSection } from '@/components/about/team-section';
import { OfficesSection } from '@/components/about/offices-section';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <AboutHero />
        <MissionVision />
        <AboutTimeline />
        <TeamSection />
        <OfficesSection />
      </main>
    </>
  );
}
