import {operatorActor} from '../../server/operations';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {database,transaction} from '../../server/db';
import {login,provisionUser,type Actor} from '../../server/auth';
import {createProject,executeCommand} from '../../server/projects';
import {sendConversationMessage} from '../../server/conversations';
import {mutateModelConnection} from '../../server/models/service';
import {cancelGenerationRequest,createGenerationRequest,listGenerationRequests} from '../../server/generation/requests';
import {estimateGeneration} from '../../server/generation/requests';
import {updateAsset} from '../../server/assets';
import {listCreatorVideoModels} from '../../server/generation/connection';
import {GET,POST} from '../../app/api/projects/[[...parts]]/route';

let admin:Actor,owner:Actor,stranger:Actor,projectId:string,foreignProjectId:string,connectionId:string,messageId:string,imageId:string,ownerCookie:string,strangerCookie:string;
const secret=`integration-only-${randomUUID()}`;
const original={keys:process.env.MODEL_CREDENTIAL_KEYS_JSON,active:process.env.MODEL_CREDENTIAL_ACTIVE_KEY,origins:process.env.MODEL_ALLOWED_ORIGINS_JSON,price:process.env.VIDEO_PRICE_CONTRACT_JSON};
const request=(overrides:Record<string,unknown>={})=>({commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,prompt:'纸雕白兔在森林中奔跑',duration:5,resolution:'768P',ratio:'16:9',target:{kind:'project'},connectionId,...overrides});

beforeAll(async()=>{
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({test:randomBytes(32).toString('base64')});
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='test';
  process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://api.tu-zi.com"]';
  delete process.env.VIDEO_PRICE_CONTRACT_JSON;
  admin=await provisionUser(`request-admin-${randomUUID()}`,`Password-${randomUUID()}`);
  const ownerPassword=`Password-${randomUUID()}`,strangerPassword=`Password-${randomUUID()}`;
  owner=await provisionUser(`request-owner-${randomUUID()}`,ownerPassword);admin=operatorActor(owner);
  stranger=await provisionUser(`request-stranger-${randomUUID()}`,strangerPassword);
  ownerCookie=`ii_session=${(await login(owner.username,ownerPassword)).token}`;
  strangerCookie=`ii_session=${(await login(stranger.username,strangerPassword)).token}`;
  projectId=(await createProject(owner,'生成请求')).id;
  foreignProjectId=(await createProject(stranger,'其他项目')).id;
  connectionId=randomUUID();
  await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:0,action:'save',config:{name:'H3 test',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false},credential:{action:'replace',value:secret}});
  messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'生成纸雕白兔视频'})).id;
  imageId=randomUUID();
  await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,content_hash,metadata) VALUES($1,$2,'reference.png','image','ready',$3,1024,$4,$5)",[imageId,projectId,`${projectId}/${imageId}`,'a'.repeat(64),{mime:'image/png',width:640,height:360}]);
});
afterAll(async()=>{
  if(projectId){await database().query('DELETE FROM assets WHERE project_id=$1',[projectId]);await database().query('DELETE FROM projects WHERE id=$1',[projectId]);}
  if(foreignProjectId)await database().query('DELETE FROM projects WHERE id=$1',[foreignProjectId]);
  if(admin){await database().query('DELETE FROM model_connection_commands WHERE actor_id=$1',[admin.id]);await transaction(async client=>{await client.query('SET CONSTRAINTS ALL DEFERRED');await client.query('DELETE FROM model_connection_versions WHERE connection_id=$1',[connectionId]);await client.query('DELETE FROM model_connections WHERE id=$1',[connectionId]);await client.query('DELETE FROM model_credentials WHERE created_by=$1',[admin.id]);});}
  for(const actor of [admin,owner,stranger].filter(Boolean)){await database().query('DELETE FROM sessions WHERE user_id=$1',[actor.id]);await database().query('DELETE FROM users WHERE id=$1',[actor.id]);}
  for(const [key,value] of Object.entries({MODEL_CREDENTIAL_KEYS_JSON:original.keys,MODEL_CREDENTIAL_ACTIVE_KEY:original.active,MODEL_ALLOWED_ORIGINS_JSON:original.origins,VIDEO_PRICE_CONTRACT_JSON:original.price})){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  vi.restoreAllMocks();await database().end();
});

describe('immutable generation request cards',()=>{
  it('exposes only owner-safe video model choices',async()=>{
    const models=await listCreatorVideoModels(owner,projectId);
    expect(models).toContainEqual(expect.objectContaining({id:connectionId,name:'H3 test',model:'MiniMax-H3',version:1,available:true}));
    expect(JSON.stringify(models)).not.toContain(secret);
    expect(JSON.stringify(models)).not.toContain('api.tu-zi.com');
    await expect(listCreatorVideoModels(stranger,projectId)).rejects.toMatchObject({status:404});
  });
  it('freezes multimodal references and the approved formula without creating a job',async()=>{
    const videoId=randomUUID();
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,content_hash,metadata) VALUES($1,$2,'clip.mp4','video','ready',$3,1024,$4,$5)",[videoId,projectId,`${projectId}/${videoId}`,'b'.repeat(64),{mime:'video/mp4',videoCodec:'h264',fps:30,duration:3.25,width:640,height:360}]);
    const media=[{assetId:imageId,refKey:randomUUID(),role:'reference_image',alias:'@图片1'},{assetId:videoId,refKey:randomUUID(),role:'reference_video',alias:'@视频1'}];
    const video={schemaVersion:2,mode:'references',prompt:'参考 @图片1 的色彩和 @视频1 的动作',duration:5,resolution:'768P',ratio:'16:9',media};
    const quote=await estimateGeneration(owner,projectId,video);
    expect(quote).toMatchObject({status:'ready',maxChargeCents:207,breakdown:{outputCents:125,inputVideoCents:82,inputVideoMs:3250}});
    const card=await createGenerationRequest(owner,projectId,{...request(),...video});
    expect(card.input).toMatchObject({schemaVersion:2,compiledPrompt:'参考 图片1 的色彩和 视频1 的动作',media:[{assetId:imageId,sha256:'a'.repeat(64)},{assetId:videoId,durationMs:3250,sha256:'b'.repeat(64)}]});
    expect(card.estimate).toMatchObject({status:'ready',maxChargeCents:207});
    await expect(updateAsset(owner,projectId,videoId,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE project_id=$1',[projectId])).rows[0].n).toBe('0');
    await expect(estimateGeneration(stranger,projectId,video)).rejects.toMatchObject({status:404});
  });
  it('atomically creates a message and request card and keeps the same identity on retry',async()=>{
    const id=randomUUID(),requestId=randomUUID(),commandId=randomUUID(),before=(await database().query('SELECT count(*) n FROM conversation_messages WHERE project_id=$1',[projectId])).rows[0].n;
    const generation={commandId,requestId,baseVersion:0,schemaVersion:2,mode:'text',prompt:'原子生成测试',duration:5,resolution:'768P',ratio:'16:9',media:[],target:{kind:'project'},connectionId};
    await expect(sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'错误请求',generation:{...generation,ratio:'adaptive'}})).rejects.toMatchObject({code:'INVALID_GENERATION_REQUEST'});
    expect((await database().query('SELECT count(*) n FROM conversation_messages WHERE project_id=$1',[projectId])).rows[0].n).toBe(before);
    const input={clientMessageId:id,text:'原子生成测试',generation};
    const first=await sendConversationMessage(owner,projectId,input),repeat=await sendConversationMessage(owner,projectId,input);
    expect(repeat).toEqual(first);expect('request' in first&&first.request).toMatchObject({id:requestId,messageId:first.id,status:'pending'});
    expect((await database().query('SELECT count(*) n FROM generation_requests WHERE id=$1',[requestId])).rows[0].n).toBe('1');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE project_id=$1',[projectId])).rows[0].n).toBe('0');
  });
  it('stores a reviewable request without provider calls, a job or a fabricated price',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('provider must not be called'));
    const input=request({referenceAssetId:imageId});
    const first=await createGenerationRequest(owner,projectId,input);
    expect(first).toMatchObject({version:1,status:'pending',input:{prompt:input.prompt,referenceAssetId:imageId},context:{sourceRevision:0,target:{kind:'project'}},connectionId,connectionVersion:1,estimate:{status:'unavailable',reason:'PRICE_CONTRACT_MISSING',requestedSeconds:5}});
    expect(await createGenerationRequest(owner,projectId,input)).toEqual(first);
    expect((await listGenerationRequests(owner,projectId)).find(card=>card.id===first.id&&card.version===first.version)).toEqual(first);
    expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
    await expect(createGenerationRequest(owner,projectId,{...input,prompt:'another'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  it('rejects a first frame outside the provider dimensions before creating a card',async()=>{
    const originalMetadata={mime:'image/png',width:640,height:360};
    try{
      for(const metadata of [{mime:'image/png',width:255,height:360},{mime:'image/png',width:5761,height:360},{mime:'image/png',width:256,height:800}]){
        await database().query('UPDATE assets SET metadata=$2 WHERE id=$1',[imageId,metadata]);
        await expect(createGenerationRequest(owner,projectId,request({referenceAssetId:imageId}))).rejects.toMatchObject({code:'REFERENCE_UNAVAILABLE'});
      }
    }finally{await database().query('UPDATE assets SET metadata=$2 WHERE id=$1',[imageId,originalMetadata]);}
  });
  it('freezes scene and project revision, and serializes competing replacements',async()=>{
    await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:0,action:'edit',operations:[{type:'scene.create',id:'scene-a',kind:'scene',title:'森林',position:{x:0,y:0}}]});
    const id=randomUUID(),first=await createGenerationRequest(owner,projectId,request({requestId:id,target:{kind:'scene',sceneId:'scene-a'}}));
    expect(first.context).toEqual({sourceRevision:1,target:{kind:'scene',sceneId:'scene-a'},connectionSelection:'explicit'});
    await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:1,action:'edit',operations:[{type:'scene.update',id:'scene-a',title:'新森林',bodyText:'changed',kind:'scene'}]});
    expect((await listGenerationRequests(owner,projectId)).find(item=>item.id===id&&item.version===1)?.context).toEqual(first.context);
    const replacements=[request({requestId:id,baseVersion:1,prompt:'镜头 A'}),request({requestId:id,baseVersion:1,prompt:'镜头 B'})];
    const outcomes=await Promise.allSettled(replacements.map(item=>createGenerationRequest(owner,projectId,item)));
    expect(outcomes.filter(item=>item.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(item=>item.status==='rejected')).toHaveLength(1);
    const rows=(await listGenerationRequests(owner,projectId)).filter(item=>item.id===id);
    expect(rows.map(item=>[item.version,item.status])).toEqual([[1,'superseded'],[2,'pending']]);
    expect(rows[0].context).toEqual(first.context);
  });
  it('rejects foreign messages/assets/targets and cancels only a pending version',async()=>{
    const foreignMessage=(await sendConversationMessage(stranger,foreignProjectId,{clientMessageId:randomUUID(),text:'foreign'})).id;
    await expect(createGenerationRequest(owner,projectId,request({messageId:foreignMessage}))).rejects.toMatchObject({code:'MESSAGE_UNAVAILABLE'});
    await expect(createGenerationRequest(stranger,projectId,request())).rejects.toMatchObject({status:404});
    await expect(createGenerationRequest(owner,projectId,request({referenceAssetId:randomUUID()}))).rejects.toMatchObject({code:'REFERENCE_UNAVAILABLE'});
    await expect(createGenerationRequest(owner,projectId,request({target:{kind:'scene',sceneId:'missing'}}))).rejects.toMatchObject({code:'TARGET_CHANGED'});
    const created=await createGenerationRequest(owner,projectId,request());
    const command={commandId:randomUUID(),requestId:created.id,version:created.version};
    expect((await cancelGenerationRequest(owner,projectId,command)).status).toBe('cancelled');
    expect((await cancelGenerationRequest(owner,projectId,command)).status).toBe('cancelled');
    await expect(cancelGenerationRequest(owner,projectId,{...command,commandId:randomUUID()})).rejects.toMatchObject({code:'REQUEST_VERSION_CONFLICT'});
    await expect(createGenerationRequest(owner,projectId,request({requestId:created.id,baseVersion:1}))).rejects.toMatchObject({code:'REQUEST_VERSION_CONFLICT'});
  });
  it('enforces owner and origin checks at the HTTP request-card endpoints',async()=>{
    const path=`http://127.0.0.1:3100/api/projects/${projectId}/generation-requests`;
    const context={params:Promise.resolve({parts:[projectId,'generation-requests']})};
    expect((await GET(new Request(path),context)).status).toBe(401);
    expect((await GET(new Request(path,{headers:{cookie:strangerCookie}}),context)).status).toBe(404);
    const rejected=await POST(new Request(path,{method:'POST',headers:{cookie:ownerCookie,origin:'https://different.example'},body:JSON.stringify(request())}),context);
    expect(rejected.status).toBe(403);
    const accepted=await POST(new Request(path,{method:'POST',headers:{cookie:ownerCookie,origin:process.env.APP_ORIGIN!},body:JSON.stringify(request())}),context);
    expect(accepted.status).toBe(201);
    const body=await accepted.text();expect(body).toContain('PRICE_CONTRACT_MISSING');expect(body).not.toContain(secret);
    const list=await GET(new Request(path,{headers:{cookie:ownerCookie}}),context);expect(list.status).toBe(200);
  });
});
