import {database} from '../server/db';
import {headMedia} from '../server/storage';
import {readArtifact} from '../server/publishing/artifacts';

type AssetRow={id:string;storage_key:string;expected_bytes:string|null};
type ReleaseRow={version_id:string;artifact_key:string;artifact_hash:string};

async function main(){
  const db=database();
  const [{rows:assets},{rows:pinnedAssets},{rows:releases},{rows:[counts]}]=await Promise.all([
    db.query<AssetRow>("SELECT id,storage_key,COALESCE(expected_bytes::text,metadata->>'size') expected_bytes FROM assets WHERE status='ready' ORDER BY id"),
    db.query<AssetRow>("SELECT asset_id id,storage_key,metadata->>'size' expected_bytes FROM published_version_assets ORDER BY version_id,asset_id"),
    db.query<ReleaseRow>("SELECT version_id,artifact_key,artifact_hash FROM publish_builds WHERE status='succeeded' ORDER BY version_id"),
    db.query<{projects:string;jobs:string;versions:string}>(`SELECT
      (SELECT count(*)::text FROM projects) projects,
      (SELECT count(*)::text FROM generation_jobs) jobs,
      (SELECT count(*)::text FROM published_versions) versions`),
  ]);
  const signal=AbortSignal.timeout(30_000);
  const stored=new Map<string,{id:string;expected:number}>();
  for(const asset of [...assets,...pinnedAssets]){
    const expected=Number(asset.expected_bytes);
    if(!Number.isSafeInteger(expected)||expected<=0)throw new Error(`asset_metadata_invalid:${asset.id}`);
    const prior=stored.get(asset.storage_key);
    if(prior&&prior.expected!==expected)throw new Error(`asset_size_conflict:${asset.id}`);
    stored.set(asset.storage_key,{id:asset.id,expected});
  }
  for(const [key,asset] of stored){
    let head;
    try{head=await headMedia(key,signal);}catch{throw new Error(`asset_storage_unavailable:${asset.id}`);}
    if(Number(head.ContentLength)!==asset.expected)throw new Error(`asset_storage_mismatch:${asset.id}`);
  }
  for(const release of releases){
    let manifest;
    try{manifest=await readArtifact(release.artifact_key,release.artifact_hash,signal);}catch{throw new Error(`release_artifact_unavailable:${release.version_id}`);}
    if(manifest.versionId!==release.version_id)throw new Error(`release_identity_mismatch:${release.version_id}`);
  }
  console.log(JSON.stringify({status:'ok',projects:Number(counts.projects),jobs:Number(counts.jobs),versions:Number(counts.versions),readyAssets:assets.length,pinnedAssets:pinnedAssets.length,readyReleases:releases.length}));
  await db.end();
}

main().catch(async error=>{
  console.error(error instanceof Error?error.message:'recovery_verification_failed');
  try{await database().end();}catch{}
  process.exitCode=1;
});
