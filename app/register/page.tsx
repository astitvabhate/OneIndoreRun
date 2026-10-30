import type { Metadata } from 'next';
import { Registration } from '../../components/Registration';
import { findRace } from '../../lib/eventData';
import './register.css';

export const metadata: Metadata = { title: 'Register | One Indore Run Indore' };

// Reading the category on the server means the full form is in the first HTML response.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <Registration initialCategory={findRace(category)?.slug} />;
}
