import Image from 'next/image';
import Link from 'next/link';
export function Logo(){ return <Link href="/" className="logo" aria-label="One Indore Run Indore home"><Image src="/assets/Logo.png" alt="One Indore Run Indore" width={180} height={140} priority /></Link> }
