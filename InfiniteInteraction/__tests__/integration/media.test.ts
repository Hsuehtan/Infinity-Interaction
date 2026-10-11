import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createMediaClipFromTimelineAsset, ensureNodeTimeline, insertTimelineClip } from '../../app/_features/node-timeline';
import { database } from '../../server/db';
import { provisionUser, type Actor } from '../../server/auth';
import { createProject, getProject, executeCommand } from '../../server/projects';
import { createUpload, receiveUpload, listAssets, assetContent, readAsset, updateAsset } from '../../server/assets';
import { processNextMedia } from '../../server/media-worker';
import { deleteMedia } from '../../server/storage';
import {enrichSelectedVideoMetadata} from '../../server/generation/media-policy';
let owner: Actor, stranger: Actor, projectId: string, png: Buffer;
const request = (data: Buffer) => new Request('http://localhost/upload', { method: 'PUT', body: new Uint8Array(data) });
const begin = async (data: Buffer, mime = 'image/png', name = '素材.png') => {
  const input = { id: randomUUID(), name, size: data.length, mime };
  await createUpload(owner, projectId, input);
  return input;
};
beforeAll(async () => {
  owner = await provisionUser(`media-${randomUUID()}`, `Password-${randomUUID()}`);
  stranger = await provisionUser(`media-${randomUUID()}`, `Password-${randomUUID()}`);
  projectId = (await createProject(owner, '媒体验证')).id;
  png = await sharp({ create: { width: 128, height: 72, channels: 3, background: '#8a72ff' } }).png().toBuffer();
});
afterAll(async () => {
  if (projectId) {
    const rows = (await database().query('SELECT storage_key FROM assets WHERE project_id=$1', [projectId])).rows;
    await Promise.all(rows.map(r => deleteMedia(r.storage_key)));
    await database().query('DELETE FROM asset_commands WHERE project_id=$1', [projectId]);
    await database().query('DELETE FROM assets WHERE project_id=$1', [projectId]);
    await database().query('DELETE FROM projects WHERE id=$1', [projectId]);
  }
  for (const actor of [owner,stranger].filter(Boolean)) await database().query('DELETE FROM users WHERE id=$1',[actor.id]);
  await database().end();
});
describe('真实私有 S3 上传与持久核验队列', () => {
  it('finishes uploads using the standalone media worker process', async () => {
    const input = await begin(png,'image/png','worker-process.png');
    await receiveUpload(owner,projectId,input.id,request(png));
    const worker=spawn(process.execPath,['--env-file=.env.local','--import','tsx','scripts/media-worker.ts'],{stdio:'ignore'});
    const exited=once(worker,'exit');
    try {
      const deadline=Date.now()+10000;
      let asset=await readAsset(owner,projectId,input.id);
      while(asset.status==='processing'&&Date.now()<deadline){await delay(150);asset=await readAsset(owner,projectId,input.id);}
      expect(asset).toMatchObject({status:'ready',attempts:1,metadata:{width:128,height:72}});
    } finally {
      worker.kill('SIGTERM');
      const force=setTimeout(()=>worker.kill('SIGKILL'),5000);
      await exited;clearTimeout(force);
      // Keep the existing tests' empty-project assumptions intact.
      const asset=await readAsset(owner,projectId,input.id);
      await deleteMedia(asset.storage_key);
      await database().query('DELETE FROM assets WHERE id=$1',[input.id]);
    }
  });
  it('verifies real image bytes, keeps identity and supports range reads after reload', async () => {
    const input = await begin(png);
    expect(await createUpload(owner, projectId, input)).toMatchObject({ id: input.id, status: 'pending' });
    expect(await receiveUpload(owner,projectId,input.id,request(png))).toMatchObject({ status:'processing' });
    expect((await getProject(owner, projectId)).assets).toHaveLength(0);
    await expect(assetContent(owner,projectId,input.id,null)).rejects.toMatchObject({ code: 'ASSET_UNAVAILABLE' });
    expect(await processNextMedia()).toBe(true);
    const row = await readAsset(owner,projectId,input.id);
    expect(row).toMatchObject({ status:'ready', metadata: { width:128,height:72,size:png.length,mime:'image/png' } });
    expect((await getProject(owner,projectId)).assets[0].id).toBe(input.id);
    const full = await assetContent(owner,projectId,input.id,null);
    expect(Buffer.from(await full.arrayBuffer())).toEqual(png);
    const range = await assetContent(owner,projectId,input.id,'bytes=0-9');
    expect(range.status).toBe(206); expect(range.headers.get('Content-Range')).toBe(`bytes 0-9/${png.length}`);
    expect(Buffer.from(await range.arrayBuffer())).toEqual(png.subarray(0,10));
    const suffix = await assetContent(owner,projectId,input.id,'bytes=-5');
    expect(Buffer.from(await suffix.arrayBuffer())).toEqual(png.subarray(-5));
    expect((await assetContent(owner,projectId,input.id,'bytes=999999-')).status).toBe(416);
    expect((await assetContent(owner,projectId,input.id,'bytes=0-1,3-4')).status).toBe(416);
    expect((await assetContent(owner,projectId,input.id,null,true)).headers.get('Content-Length')).toBe(String(png.length));
    // Retrying even with different bytes cannot replace an accepted object.
    await receiveUpload(owner,projectId,input.id,request(Buffer.from('different')));
    expect(Buffer.from(await (await assetContent(owner,projectId,input.id,null)).arrayBuffer())).toEqual(png);
    expect((await getProject(owner,projectId)).revision).toBe(0);
  });
  it('rejects cross-owner access, session substitution, malicious names and limits', async () => {
    const input = await begin(png);
    await expect(createUpload(stranger,projectId,{ ...input,id:randomUUID() })).rejects.toMatchObject({ status:404 });
    await expect(receiveUpload(stranger,projectId,input.id,request(png))).rejects.toMatchObject({ status:404 });
    await expect(listAssets(stranger,projectId)).rejects.toMatchObject({ status:404 });
    await expect(assetContent(stranger,projectId,input.id,null)).rejects.toMatchObject({ status:404 });
    await expect(createUpload(owner,projectId,{ ...input,name:'other.png' })).rejects.toMatchObject({ code:'UPLOAD_CONFLICT' });
    await expect(createUpload(owner,projectId,{ ...input,id:randomUUID(),name:'../secret' })).rejects.toMatchObject({ code:'INVALID_UPLOAD' });
    await expect(createUpload(owner,projectId,{ ...input,id:randomUUID(),size:2**30 })).rejects.toMatchObject({ status:413 });
    await expect(createUpload(owner,projectId,{ ...input,id:randomUUID(),mime:'text/html' })).rejects.toMatchObject({ status:415 });
    expect((await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/`)).status).toBe(403);
  });
  it('recovers interrupted upload without creating a duplicate asset', async () => {
    const input = await begin(png);
    await expect(receiveUpload(owner,projectId,input.id,request(png.subarray(0,5)))).rejects.toMatchObject({ code:'SIZE_MISMATCH' });
    expect(await readAsset(owner,projectId,input.id)).toMatchObject({ status:'pending',lease_token:null });
    await receiveUpload(owner,projectId,input.id,request(png)); await processNextMedia();
    expect(await readAsset(owner,projectId,input.id)).toMatchObject({ status:'ready' });
    expect((await database().query('SELECT * FROM assets WHERE id=$1',[input.id])).rowCount).toBe(1);
  });
  it('renames idempotently, reports usage and only archives unreferenced media',async()=>{
    const input=await begin(png,'image/png','library.png');await receiveUpload(owner,projectId,input.id,request(png));await processNextMedia();
    const commandId=randomUUID(),renamed=await updateAsset(owner,projectId,input.id,{commandId,action:'rename',name:'新的封面.png'});
    expect(renamed).toMatchObject({archived:false,asset:{id:input.id,name:'新的封面.png',usage:{draft:[],publishedVersions:0}}});
    expect(await updateAsset(owner,projectId,input.id,{commandId,action:'rename',name:'新的封面.png'})).toEqual(renamed);
    await expect(updateAsset(owner,projectId,input.id,{commandId,action:'rename',name:'另一个名称.png'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    await expect(updateAsset(stranger,projectId,input.id,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({status:404});
    expect(await updateAsset(owner,projectId,input.id,{commandId:randomUUID(),action:'archive'})).toMatchObject({archived:true});
    expect((await listAssets(owner,projectId)).assets.some(asset=>asset.id===input.id)).toBe(false);
    await expect(assetContent(owner,projectId,input.id,null)).rejects.toMatchObject({status:404});
  });
  it('rejects corrupt and mislabeled media; only one concurrent worker claims each item', async () => {
    const invalid = Buffer.from('<html>not a movie</html>'), input = await begin(invalid,'video/mp4','fake.mp4');
    await receiveUpload(owner,projectId,input.id,request(invalid));
    expect((await Promise.all([processNextMedia(),processNextMedia()])).filter(Boolean)).toHaveLength(1);
    expect(await readAsset(owner,projectId,input.id)).toMatchObject({ status:'failed',attempts:1 });
    const mislabeled = await begin(png,'video/mp4','image.mp4');
    await receiveUpload(owner,projectId,mislabeled.id,request(png)); await processNextMedia();
    expect(await readAsset(owner,projectId,mislabeled.id)).toMatchObject({ status:'failed',error:'文件实际内容与声明的媒体类型不一致。' });
  });
  it('decodes real video, enforces actual source duration and preserves assets on undo', async () => {
    const video = await readFile('__tests__/fixtures/media/test-motion.mp4');
    const input = await begin(video,'video/mp4','motion.mp4');
    await receiveUpload(owner,projectId,input.id,request(video)); await processNextMedia();
    const asset = await readAsset(owner,projectId,input.id);
    expect(asset).toMatchObject({ status:'ready',metadata:{ duration:3,width:640,height:360,hasAudio:true } });
    expect(Number(asset.metadata.fps)).toBeGreaterThanOrEqual(23.976);
    await database().query("UPDATE assets SET metadata=metadata-'fps' WHERE id=$1",[input.id]);
    await enrichSelectedVideoMetadata(projectId,{schemaVersion:2,mode:'references',prompt:'测试引用',duration:5,resolution:'768P',ratio:'16:9',media:[{assetId:input.id,role:'reference_video',refKey:randomUUID()}]});
    expect(Number((await readAsset(owner,projectId,input.id)).metadata.fps)).toBeGreaterThanOrEqual(23.976);
    const id = randomUUID();
    const execute = async (operations: unknown[], action='edit') => {
      const current = await getProject(owner,projectId);
      return executeCommand(owner,projectId,{ commandId:randomUUID(),baseRevision:current.revision,action,operations });
    };
    await execute([{ type:'scene.create',id,kind:'start',title:'开始',position:{x:0,y:0} }]);
    const clip = createMediaClipFromTimelineAsset({ type:'video',src:'https://untrusted.example/movie',name:'movie',assetId:asset.id,startTime:0,metadata:asset.metadata });
    const timeline = insertTimelineClip({ timeline:ensureNodeTimeline(),clip });
    await execute([{ type:'timeline.replace',id,timeline }]);
    let current = await getProject(owner,projectId);
    expect(current.graph.nodes[0].data.timeline?.tracks[0].clips[0]).toMatchObject({ assetId:asset.id,src:`/api/projects/${projectId}/assets/${asset.id}/content`,sourceDuration:3 });
    expect((await listAssets(owner,projectId)).assets.find(item=>item.id===asset.id)?.usage?.draft).toEqual([expect.objectContaining({kind:'clip',nodeId:id,clipId:clip.id})]);
    await expect(updateAsset(owner,projectId,asset.id,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
    const invalid = structuredClone(timeline); invalid.tracks[0].clips[0].duration=30;
    await expect(execute([{ type:'timeline.replace',id,timeline:invalid }])).rejects.toMatchObject({ code:'INVALID_TRIM' });
    await execute([],'undo');
    current = await getProject(owner,projectId);
    expect(current.graph.nodes[0].data.timeline?.tracks.flatMap(t=>t.clips)).toHaveLength(0);
    expect(current.assets.some(a=>a.id===asset.id)).toBe(true);
    await execute([],'redo');
    expect((await getProject(owner,projectId)).graph.nodes[0].data.timeline?.tracks[0].clips[0].id).toBe(clip.id);
  });
  it('recovers an expired processing lease and probes actual audio duration', async () => {
    const bytes = 16000, wav = Buffer.alloc(44+bytes);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(bytes,40);
    const input = await begin(wav,'audio/wav','tone.wav');
    await receiveUpload(owner,projectId,input.id,request(wav));
    await database().query("UPDATE assets SET lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",[input.id,randomUUID()]);
    await processNextMedia();
    expect(await readAsset(owner,projectId,input.id)).toMatchObject({ status:'ready',metadata:{ duration:1,mime:'audio/wav',audioCodec:'pcm_s16le' } });
  });
});
