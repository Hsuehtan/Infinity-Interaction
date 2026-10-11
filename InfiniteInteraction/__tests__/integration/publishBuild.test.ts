import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {database} from '../../server/db';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject,executeCommand,getProject} from '../../server/projects';
import {createUpload} from '../../server/assets';
import {putMedia,deleteMedia,putArtifact} from '../../server/storage';
import {freezeVersion,listVersions} from '../../server/publishing/service';
import {requestBuild} from '../../server/publishing/build-requests';
import {claimPublishBuild,runPublishBuild,type BuildLease} from '../../server/publishing/worker';
import {publishedManifest,publishedAsset} from '../../server/publishing/public-access';
import {GET as publicAssetGet} from '../../app/api/published/[versionId]/assets/[assetId]/route';
import {createInteractionTemplate} from '../../app/_features/node-timeline/interaction-templates';
import type {Operation} from '../../app/infinite/model';
let actor:Actor,other:Actor,dir:string;
const keys=new Set<string>();
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64');
const command=(revision:number,operations:Operation[])=>({commandId:randomUUID(),baseRevision:revision,action:'edit',operations});
async function story(){
  const p=await createProject(actor,'独立玩家验收'),clips=createInteractionTemplate('choice',0,3);
  await executeCommand(actor,p.id,command(0,[{type:'scene.create',id:'start',kind:'start',title:'开始',position:{x:0,y:0}},{type:'scene.create',id:'end',kind:'end',title:'结局',position:{x:0,y:0}},{type:'timeline.replace',id:'start',timeline:{version:2,duration:3,bookmarks:[],tracks:[{id:'i',name:'选择',type:'interaction',clips}]}},...clips.map(c=>({type:'edge.connect' as const,id:randomUUID(),source:'start',sourceHandle:`button:${c.id}:click`,target:'end'}))]));
  return getProject(actor,p.id);
}
async function imageAsset(projectId:string){
  const id=randomUUID(),key=`test-publish-build/${id}`,file=join(dir,id);await writeFile(file,bytes);await putMedia(key,file,bytes.length);keys.add(key);
  await createUpload(actor,projectId,{id,name:'private-file.png',mime:'image/png',size:bytes.length});
  await database().query("UPDATE assets SET status='ready',storage_key=$2,metadata=$3 WHERE id=$1",[id,key,{size:bytes.length,mime:'image/png',width:1,height:1}]);return {id,key,file};
}
const activate=(generation=0)=>({commandId:randomUUID(),baseGeneration:generation,shareScope:'unlisted'});
async function run(lease:BuildLease){keys.add(`published/${lease.version_id}/${lease.generation}/${lease.lease_token}/manifest.json`);return runPublishBuild(lease);}
beforeAll(async()=>{actor=await provisionUser(`build-${randomUUID()}`,'Test-only-build-password');other=await provisionUser(`build-${randomUUID()}`,'Test-only-build-password');dir=await mkdtemp(join(tmpdir(),'publish-build-'));});
afterAll(async()=>{
  for(const key of keys)await deleteMedia(key);if(dir)await rm(dir,{recursive:true,force:true});
  for(const user of [actor,other].filter(Boolean)){
    await database().query('DELETE FROM published_versions WHERE project_id IN (SELECT id FROM projects WHERE owner_id=$1)',[user.id]);await database().query('DELETE FROM assets WHERE project_id IN (SELECT id FROM projects WHERE owner_id=$1)',[user.id]);await database().query('DELETE FROM projects WHERE owner_id=$1',[user.id]);await database().query('DELETE FROM users WHERE id=$1',[user.id]);
  }await database().end();
});
describe('发布构建与匿名玩家的真实 DB/S3 边界',()=>{
  it('requires explicit owner sharing confirmation and accepts exact retry once',async()=>{
    const p=await story(),v=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:1});
    expect(await claimPublishBuild(v.id)).toBeNull();await expect(publishedManifest(v.id)).rejects.toMatchObject({status:404});
    await expect(requestBuild(other,p.id,v.id,activate())).rejects.toMatchObject({status:404});
    await expect(requestBuild(actor,p.id,v.id,{commandId:randomUUID(),baseGeneration:0})).rejects.toMatchObject({status:400});
    const request=activate();const [a,b]=await Promise.all([requestBuild(actor,p.id,v.id,request),requestBuild(actor,p.id,v.id,request)]);expect(a).toEqual(b);expect(a.generation).toBe(1);
    await expect(requestBuild(actor,p.id,v.id,{...request,baseGeneration:1})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    await expect(requestBuild(actor,p.id,v.id,activate())).rejects.toMatchObject({code:'BUILD_CONFLICT'});
    await expect(publishedManifest(v.id)).rejects.toMatchObject({status:404});
  });
  it('recovers an expired lease and fences stale workers while keeping source revision fixed',async()=>{
    const p=await story(),v=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:1});await requestBuild(actor,p.id,v.id,activate());
    const old=await claimPublishBuild(v.id);expect(old).not.toBeNull();expect(await claimPublishBuild(v.id)).toBeNull();
    await executeCommand(actor,p.id,command(1,[{type:'project.rename',title:'编辑中的新草稿'}]));
    await database().query("UPDATE publish_builds SET lease_until=now()-interval '1 second' WHERE version_id=$1",[v.id]);const current=await claimPublishBuild(v.id);expect(current!.lease_token).not.toBe(old!.lease_token);
    expect(await run(old!)).toBe(false);await expect(publishedManifest(v.id)).rejects.toMatchObject({status:404});expect(await run(current!)).toBe(true);
    const manifest=await publishedManifest(v.id);expect(manifest.sourceRevision).toBe(1);expect(manifest.snapshot.title).toBe('独立玩家验收');
    expect(JSON.stringify(manifest)).not.toContain('storage_key');expect((await listVersions(actor,p.id))[0]).toMatchObject({status:'ready',url:`/p/${v.id}`});
    await expect(requestBuild(actor,p.id,v.id,activate(1))).rejects.toMatchObject({code:'BUILD_ACTIVE'});
  });
  it('serves only pinned media anonymously with correct ranges and rejects draft/unreferenced assets',async()=>{
    const p=await story(),asset=await imageAsset(p.id),unused=await imageAsset(p.id),timeline=structuredClone(p.graph.nodes[0].data.timeline!);
    timeline.tracks.push({id:'media',type:'media',name:'Media',clips:[{id:'picture',type:'image',enabled:true,assetId:asset.id,src:'placeholder',startTime:0,duration:3}]});
    await executeCommand(actor,p.id,command(1,[{type:'timeline.replace',id:'start',timeline:timeline as unknown as Record<string,unknown>}]));
    const v=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:2});await expect(publishedAsset(v.id,asset.id,null)).rejects.toMatchObject({status:404});await requestBuild(actor,p.id,v.id,activate());expect(await run((await claimPublishBuild(v.id))!)).toBe(true);
    const context={params:Promise.resolve({versionId:v.id,assetId:asset.id})};
    const result=await publicAssetGet(new Request(`http://localhost/api/published/${v.id}/assets/${asset.id}`,{headers:{Range:'bytes=1-8'}}),context);expect(result.status).toBe(206);expect(result.headers.get('content-range')).toBe(`bytes 1-8/${bytes.length}`);expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes.subarray(1,9));
    const head=await publishedAsset(v.id,asset.id,null,true);expect(head.headers.get('content-type')).toBe('image/png');expect(head.headers.get('content-length')).toBe(String(bytes.length));
    expect((await publishedAsset(v.id,asset.id,'bytes=999999-')).status).toBe(416);await expect(publishedAsset(v.id,unused.id,null)).rejects.toMatchObject({status:404});
    const privateVersion=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:2});await expect(publishedAsset(privateVersion.id,asset.id,null)).rejects.toMatchObject({status:404});
  });
  it('keeps an old release valid after a failed new build and retries the same snapshot',async()=>{
    const p=await story(),old=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:1});await requestBuild(actor,p.id,old.id,activate());await run((await claimPublishBuild(old.id))!);
    const asset=await imageAsset(p.id),timeline=structuredClone(p.graph.nodes[0].data.timeline!);timeline.tracks.push({id:'m',type:'media',name:'Media',clips:[{id:'picture',type:'image',enabled:true,assetId:asset.id,src:'placeholder',startTime:0,duration:3}]});await executeCommand(actor,p.id,command(1,[{type:'timeline.replace',id:'start',timeline:timeline as unknown as Record<string,unknown>}]));
    const next=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:2});await requestBuild(actor,p.id,next.id,activate());await deleteMedia(asset.key);expect(await run((await claimPublishBuild(next.id))!)).toBe(false);
    expect((await listVersions(actor,p.id))[0]).toMatchObject({status:'failed',url:null,buildGeneration:1});expect((await publishedManifest(old.id)).sourceRevision).toBe(1);await expect(publishedManifest(next.id)).rejects.toMatchObject({status:404});
    await putMedia(asset.key,asset.file,bytes.length);await requestBuild(actor,p.id,next.id,activate(1));expect(await run((await claimPublishBuild(next.id))!)).toBe(true);expect((await publishedManifest(next.id)).sourceRevision).toBe(2);
    const {rows:[artifact]}=await database().query('SELECT artifact_key FROM publish_builds WHERE version_id=$1',[next.id]);await putArtifact(artifact.artifact_key,Buffer.from('{}'),AbortSignal.timeout(10000));await expect(publishedManifest(next.id)).rejects.toMatchObject({code:'ARTIFACT_UNAVAILABLE'});expect((await publishedManifest(old.id)).sourceRevision).toBe(1);
  });
});
