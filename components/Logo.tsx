import Image from 'next/image';
import Link from 'next/link';
export function Logo(){ return <Link href="/" className="logo" aria-label="One Indore Run home"><Image src="/assets/Logo.png" alt="One Indore Run" width={180} height={140} priority /></Link> }
