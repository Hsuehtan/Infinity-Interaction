import {randomUUID} from 'node:crypto';
import {database,transaction} from '../db';
import {getMedia,headMedia} from '../storage';
import {requireCondition} from '../errors';
import {validateProject} from '../../shared/validate-project';
import type {PlaybackSnapshot} from '../../shared/publishing';
import type {OpenFMVAsset} from '../../app/_types';
import {writeArtifact,type PlaybackManifest} from './artifacts';
export type BuildLease={version_id:string;generation:number;lease_token:string;attempts:number};
export async function claimPublishBuild(versionId?:string):Promise<BuildLease|null>{
  const {rows:[build]}=await database().query<BuildLease>(`UPDATE publish_builds SET status='running',lease_token=$1,lease_until=now()+interval '3 minutes',attempts=attempts+1
    WHERE version_id=(SELECT version_id FROM publish_builds WHERE (status='queued' OR (status='running' AND lease_until<now())) AND ($2::uuid IS NULL OR version_id=$2) ORDER BY confirmed_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[randomUUID(),versionId??null]);return build??null;
}
export async function runPublishBuild(lease:BuildLease){
  const signal=AbortSignal.timeout(90_000);
  try{
    requireCondition(lease.attempts<=5,503,'BUILD_ATTEMPTS','构建多次中断，请手动重试。');
    const {rows:[version]}=await database().query<{snapshot:PlaybackSnapshot;source_revision:number}>('SELECT snapshot,source_revision FROM published_versions WHERE id=$1',[lease.version_id]);
    requireCondition(version,404,'VERSION_NOT_FOUND','版本不存在。');
    const {rows:refs}=await database().query<{asset_id:string;storage_key:string;media_type:OpenFMVAsset['type'];metadata:Record<string,unknown>}>('SELECT * FROM published_version_assets WHERE version_id=$1 ORDER BY asset_id',[lease.version_id]);
    const assets:OpenFMVAsset[]=refs.map(ref=>({id:ref.asset_id,type:ref.media_type,name:'',path:'',relativePath:'',importedAt:'',metadata:ref.metadata}));
    requireCondition(!validateProject(version.snapshot.graph,assets).some(issue=>issue.severity==='error'),409,'INVALID_SNAPSHOT','固定版本未通过作品检查。');
    let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,refs.length)},async()=>{
      while(cursor<refs.length){const ref=refs[cursor++],head=await headMedia(ref.storage_key,signal);requireCondition(head.ContentLength===Number(ref.metadata.size)&&Number(ref.metadata.size)>0,503,'ASSET_UNAVAILABLE','作品媒体不可读取。');
        const content=await getMedia(ref.storage_key,'bytes=0-0',signal);requireCondition(content.Body&&content.ContentLength===1,503,'ASSET_UNAVAILABLE','作品媒体不可读取。');
        requireCondition((await content.Body.transformToByteArray()).length===1,503,'ASSET_UNAVAILABLE','作品媒体不可读取。');
      }
    }));
    const manifest:PlaybackManifest={format:1,runtimeVersion:1,versionId:lease.version_id,sourceRevision:version.source_revision,snapshot:version.snapshot,assets:refs.map(ref=>({id:ref.asset_id,type:ref.media_type,size:Number(ref.metadata.size),mime:String(ref.metadata.mime)}))};
    const key=`published/${lease.version_id}/${lease.generation}/${lease.lease_token}/manifest.json`;
    const hash=await writeArtifact(key,manifest,signal);
    return await transaction(async client=>{
      const result=await client.query("UPDATE publish_builds SET status='succeeded',artifact_key=$4,artifact_hash=$5,completed_at=now(),lease_until=NULL WHERE version_id=$1 AND generation=$2 AND lease_token=$3 AND status='running' AND lease_until>now() RETURNING version_id",[lease.version_id,lease.generation,lease.lease_token,key,hash]);
      if(!result.rowCount)return false;
      await client.query("UPDATE published_versions SET status='ready',error=NULL WHERE id=$1 AND status='building'",[lease.version_id]);return true;
    });
  }catch{
    await transaction(async client=>{
      const result=await client.query("UPDATE publish_builds SET status='failed',lease_until=NULL WHERE version_id=$1 AND generation=$2 AND lease_token=$3 AND status='running' AND lease_until>now() RETURNING version_id",[lease.version_id,lease.generation,lease.lease_token]);
      if(result.rowCount)await client.query("UPDATE published_versions SET status='failed',error='构建未完成。请确认引用媒体可用后重试；已发布版本不受影响。' WHERE id=$1 AND status='building'",[lease.version_id]);
    });return false;
  }
}
export async function processNextPublication(){const lease=await claimPublishBuild();if(!lease)return false;await runPublishBuild(lease);return true;}
