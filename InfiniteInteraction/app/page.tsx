import { Suspense } from 'react';
import Workbench from './infinite/Workbench';
export default function Page() { return <Suspense fallback={<main className="boot-state">正在打开工作台…</main>}><Workbench /></Suspense>; }
