import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {database} from '../../server/db';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject,executeCommand,getProject} from '../../server/projects';
import {createUpload} from '../../server/assets';
import {putMedia,deleteMedia} from '../../server/storage';
import {checkPublication,freezeVersion,listVersions} from '../../server/publishing/service';
import {createInteractionTemplate} from '../../app/_features/node-timeline/interaction-templates';
import type {Operation} from '../../app/infinite/model';
let actor:Actor,other:Actor,dir:string;
const keys:string[]=[];
const command=(revision:number,operations:Operation[])=>({commandId:randomUUID(),baseRevision:revision,action:'edit',operations});
async function story(){
  const p=await createProject(actor,'发布验收'),clips=createInteractionTemplate('choice',0,3);
  await executeCommand(actor,p.id,command(0,[{type:'scene.create',id:'start',kind:'start',title:'开始',position:{x:0,y:0}},{type:'scene.create',id:'end',kind:'end',title:'结局',position:{x:0,y:0}},{type:'timeline.replace',id:'start',timeline:{version:2,duration:3,bookmarks:[],tracks:[{id:'i',name:'选择',type:'interaction',clips}]}},...clips.map(c=>({type:'edge.connect' as const,id:randomUUID(),source:'start',sourceHandle:`button:${c.id}:click`,target:'end'}))]));
  return getProject(actor,p.id);
}
async function imageAsset(projectId:string,legacyMetadata=false){
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64');
  const id=randomUUID(),key=`test-publish/${id}`,file=join(dir,id);await writeFile(file,bytes);await putMedia(key,file,bytes.length);keys.push(key);
  await createUpload(actor,projectId,{id,name:'private-filename.png',mime:'image/png',size:bytes.length});
  await database().query("UPDATE assets SET status='ready',storage_key=$2,metadata=$3 WHERE id=$1",[id,key,{...(!legacyMetadata?{size:bytes.length}:{}),mime:'image/png',width:1,height:1,privateNote:'PRIVATE_METADATA'}]);
  return {id,key,size:bytes.length};
}
beforeAll(async()=>{actor=await provisionUser(`pub-${randomUUID()}`,'Test-only-publish-password');other=await provisionUser(`pub-${randomUUID()}`,'Test-only-publish-password');dir=await mkdtemp(join(tmpdir(),'publish-test-'));});
afterAll(async()=>{
  for(const key of keys)await deleteMedia(key);
  if(dir)await rm(dir,{recursive:true,force:true});
  for(const user of [actor,other].filter(Boolean)){
    await database().query('DELETE FROM published_versions WHERE project_id IN (SELECT id FROM projects WHERE owner_id=$1)',[user.id]);
    await database().query('DELETE FROM assets WHERE project_id IN (SELECT id FROM projects WHERE owner_id=$1)',[user.id]);
    await database().query('DELETE FROM projects WHERE owner_id=$1',[user.id]);await database().query('DELETE FROM users WHERE id=$1',[user.id]);
  }
  await database().end();
});
describe('真实 PostgreSQL/S3 · 发布快照',()=>{
  it('rejects other owners and invalid drafts without creating a version',async()=>{
    const p=await createProject(actor,'空草稿');
    expect(await checkPublication(actor,p.id)).toMatchObject({canPublish:false,issues:[{code:'ENTRY'}]});
    for(const action of [()=>checkPublication(other,p.id),()=>listVersions(other,p.id),()=>freezeVersion(other,p.id,{commandId:randomUUID(),sourceRevision:0})])await expect(action()).rejects.toMatchObject({status:404});
    await expect(freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:0})).rejects.toMatchObject({code:'PUBLISH_CHECK_FAILED'});
    expect(await listVersions(actor,p.id)).toEqual([]);
  });
  it('pins revision once across exact retries, later edits, and server history operations',async()=>{
    const p=await story(),request={commandId:randomUUID(),sourceRevision:p.revision};
    const [a,b]=await Promise.all([freezeVersion(actor,p.id,request),freezeVersion(actor,p.id,request)]);expect(a).toEqual(b);
    expect(a).toMatchObject({sourceRevision:1,status:'pending',url:null,number:1});
    await executeCommand(actor,p.id,command(1,[{type:'project.rename',title:'新版草稿'}]));
    expect(await freezeVersion(actor,p.id,request)).toEqual(a);
    await expect(freezeVersion(actor,p.id,{...request,sourceRevision:2})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    const row=(await database().query('SELECT snapshot FROM published_versions WHERE id=$1',[a.id])).rows[0];expect(row.snapshot.title).toBe('发布验收');
    await executeCommand(actor,p.id,{commandId:randomUUID(),baseRevision:2,action:'undo',operations:[]});expect(await listVersions(actor,p.id)).toHaveLength(1);
    await expect(database().query("UPDATE published_versions SET snapshot='{}' WHERE id=$1",[a.id])).rejects.toThrow('immutable');
  });
  it('serializes publication against editing; never labels a new draft as the old revision',async()=>{
    const p=await story();
    const [publish,edit]=await Promise.allSettled([freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:1}),executeCommand(actor,p.id,command(1,[{type:'project.rename',title:'并发新版'}]))]);
    expect(edit.status).toBe('fulfilled');
    if(publish.status==='fulfilled'){
      const row=(await database().query('SELECT snapshot,source_revision FROM published_versions WHERE id=$1',[publish.value.id])).rows[0];expect(row.source_revision).toBe(1);expect(row.snapshot.title).toBe('发布验收');
    }else expect(publish.reason).toMatchObject({code:'REVISION_CONFLICT'});
    await expect(freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:1})).rejects.toMatchObject({code:'REVISION_CONFLICT'});
  });
  it('checks actual private storage and pins only referenced media without authoring data',async()=>{
    let p=await story();const asset=await imageAsset(p.id,true);const unused=await imageAsset(p.id);await deleteMedia(unused.key);
    const timeline=structuredClone(p.graph.nodes[0].data.timeline!);timeline.tracks.push({id:'media',type:'media',name:'PRIVATE_TRACK',clips:[{id:'picture',type:'image',assetId:asset.id,src:'file:///PRIVATE',enabled:true,startTime:0,duration:3}]});
    await executeCommand(actor,p.id,command(1,[{type:'timeline.replace',id:'start',timeline:timeline as unknown as Record<string,unknown>},{type:'scene.update',id:'start',kind:'start',title:'开始',bodyText:'PRIVATE_PROSE'},{type:'reference.upsert',reference:{schemaVersion:2,id:'reference',category:'person',name:'PRIVATE_REFERENCE',description:'PRIVATE_INPUT',assetIds:[unused.id],details:{}}}]));
    p=await getProject(actor,p.id);expect(await checkPublication(actor,p.id)).toMatchObject({canPublish:true,assetCount:1});
    const version=await freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:p.revision});
    const {rows:[row]}=await database().query('SELECT snapshot FROM published_versions WHERE id=$1',[version.id]);const refs=(await database().query('SELECT * FROM published_version_assets WHERE version_id=$1',[version.id])).rows;
    expect(refs).toHaveLength(1);expect(refs[0]).toMatchObject({asset_id:asset.id,metadata:{size:asset.size}});expect(JSON.stringify(row)).not.toContain('PRIVATE');expect(JSON.stringify(refs)).not.toContain('PRIVATE_METADATA');expect(JSON.stringify(row)).not.toContain('/api/projects/');
    await expect(database().query("UPDATE published_version_assets SET storage_key='changed' WHERE version_id=$1",[version.id])).rejects.toThrow('immutable');
    await deleteMedia(asset.key);const check=await checkPublication(actor,p.id);expect(check.canPublish).toBe(false);expect(check.issues).toContainEqual(expect.objectContaining({code:'ASSET_READ',nodeId:'start',clipId:'picture'}));
    await expect(freezeVersion(actor,p.id,{commandId:randomUUID(),sourceRevision:p.revision})).rejects.toMatchObject({code:'PUBLISH_CHECK_FAILED'});expect(await listVersions(actor,p.id)).toHaveLength(1);
  });
});
