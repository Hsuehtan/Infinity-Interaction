import {notFound} from 'next/navigation';
import {z} from 'zod';
import {publishedManifest} from '@/server/publishing/public-access';
import {AppError} from '@/server/errors';
import PublishedPlayer from './PublishedPlayer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'互动作品 · Infinite Interaction',robots:{index:false,follow:false}};
export default async function PublishedPage({params}:{params:Promise<{versionId:string}>}){
  const {versionId}=await params;if(!z.uuid().safeParse(versionId).success)notFound();
  let manifest;
  try{manifest=await publishedManifest(versionId);}
  catch(error){if(error instanceof AppError&&error.status===404)notFound();throw error;}
  return <PublishedPlayer snapshot={manifest.snapshot}/>;
}
