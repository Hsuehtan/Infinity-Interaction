'use client';
export default function PublicationError({reset}:{reset:()=>void}){return <main className="published-landing"><h1>作品暂时无法载入</h1><p>请检查网络后重试。</p><button className="primary" onClick={reset}>重新载入</button></main>;}
