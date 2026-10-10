import { Registration } from '../../components/Registration';
import './register.css';
import { Suspense } from 'react';
export default function RegisterPage(){return <Suspense fallback={<main className="reg"/>}><Registration/></Suspense>}
