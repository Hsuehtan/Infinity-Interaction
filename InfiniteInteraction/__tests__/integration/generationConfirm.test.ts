import {operatorActor} from '../../server/operations';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {database,transaction} from '../../server/db';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject} from '../../server/projects';
import {sendConversationMessage} from '../../server/conversations';
import {mutateModelConnection} from '../../server/models/service';
import {createGenerationRequest} from '../../server/generation/requests';
import {confirmGenerationRequest,listGenerationJobs} from '../../server/generation/confirm';

let admin:Actor,owner:Actor,other:Actor,projectId:string,connectionId:string,extraConnectionId:string|undefined;
const secret=`synthetic-${randomUUID()}`;
const names=['MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY','MODEL_ALLOWED_ORIGINS_JSON','VIDEO_PRICE_CONTRACT_JSON','VIDEO_PROJECT_BUDGET_CENTS','VIDEO_MAX_CONCURRENT_JOBS','VIDEO_CONFIRM_ENABLED'] as const;
const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
const config={name:'H3 fixture',protocol:'tuzi-minimax-h3' as const,baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false};
const price=(amount=120)=>JSON.stringify({id:'test-tariff',currency:'CNY',source:'synthetic integration contract',reviewedAt:'2026-09-01T00:00:00.000Z',validUntil:'2030-01-01T00:00:00.000Z',entries:[{mode:'text',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:amount},{mode:'first-frame',duration:5,resolution:'768P',ratio:'adaptive',maxChargeCents:180}]});
const requestInput=(messageId:string,overrides:Record<string,unknown>={})=>({commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,prompt:'海边城市的晨光',duration:5,resolution:'768P',ratio:'16:9',target:{kind:'project'},connectionId,...overrides});
async function newRequest(){const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'生成晨光视频'})).id;return createGenerationRequest(owner,projectId,requestInput(messageId));}
const confirm=(request:{id:string;version:number},commandId=randomUUID())=>confirmGenerationRequest(owner,projectId,{commandId,requestId:request.id,version:request.version});

beforeAll(async()=>{
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({test:randomBytes(32).toString('base64')});
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='test';
  process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://api.tu-zi.com"]';
  process.env.VIDEO_PRICE_CONTRACT_JSON=price();
  process.env.VIDEO_PROJECT_BUDGET_CENTS='1000';
  process.env.VIDEO_MAX_CONCURRENT_JOBS='10';
  process.env.VIDEO_CONFIRM_ENABLED='true';
  admin=await provisionUser(`confirm-admin-${randomUUID()}`,`Password-${randomUUID()}`);
  owner=await provisionUser(`confirm-owner-${randomUUID()}`,`Password-${randomUUID()}`);admin=operatorActor(owner);
  other=await provisionUser(`confirm-other-${randomUUID()}`,`Password-${randomUUID()}`);
  projectId=(await createProject(owner,'额度事务')).id;
  connectionId=randomUUID();
  await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:0,action:'save',config,credential:{action:'replace',value:secret}});
});
afterAll(async()=>{
  if(projectId){await database().query('DELETE FROM assets WHERE project_id=$1',[projectId]);await database().query('DELETE FROM projects WHERE id=$1',[projectId]);}
  if(admin){await database().query('DELETE FROM model_connection_commands WHERE actor_id=$1',[admin.id]);await transaction(async client=>{await client.query('SET CONSTRAINTS ALL DEFERRED');for(const id of [connectionId,extraConnectionId].filter(Boolean)){await client.query('DELETE FROM model_connection_versions WHERE connection_id=$1',[id]);await client.query('DELETE FROM model_connections WHERE id=$1',[id]);}await client.query('DELETE FROM model_credentials WHERE created_by=$1',[admin.id]);});}
  for(const actor of [admin,owner,other].filter(Boolean))await database().query('DELETE FROM users WHERE id=$1',[actor.id]);
  for(const name of names){const value=original[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}
  vi.restoreAllMocks();await database().end();
});

describe('transactional video confirmation without provider I/O',()=>{
  it('reserves once, creates one job under concurrent confirmation and returns it on retransmission',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('provider must not be contacted'));
    const card=await newRequest();expect(card.estimate).toMatchObject({status:'ready',maxChargeCents:120});
    const commands=[randomUUID(),randomUUID()];
    const [first,second]=await Promise.all(commands.map(id=>confirm(card,id)));
    expect(first.id).toBe(second.id);
    expect((await confirm(card,commands[0])).id).toBe(first.id);
    expect((await confirm(card,randomUUID())).id).toBe(first.id);
    const {rows:[account]}=await database().query('SELECT * FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(account.reserved_cents)).toBe(120);expect(Number(account.spent_cents)).toBe(0);
    expect((await database().query('SELECT * FROM generation_usage_events WHERE job_id=$1',[first.id])).rows).toHaveLength(1);
    expect((await listGenerationJobs(owner,projectId))).toHaveLength(1);
    await expect(listGenerationJobs(other,projectId)).rejects.toMatchObject({status:404});
    expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
  });
  it('rejects missing, stale or changed price and leaves the request pending',async()=>{
    const card=await newRequest();
    process.env.VIDEO_CONFIRM_ENABLED='false';
    await expect(confirm(card)).rejects.toMatchObject({code:'VIDEO_CONFIRM_DISABLED'});
    process.env.VIDEO_CONFIRM_ENABLED='true';
    process.env.VIDEO_PRICE_CONTRACT_JSON=price(130);
    await expect(confirm(card)).rejects.toMatchObject({code:'ESTIMATE_STALE'});
    process.env.VIDEO_PRICE_CONTRACT_JSON=price();
    const {rows:[row]}=await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version]);
    expect(row.status).toBe('pending');
    const {rows:[jobs]}=await database().query<{count:string}>('SELECT count(*) FROM generation_jobs WHERE request_id=$1',[card.id]);expect(Number(jobs.count)).toBe(0);
  });
  it('rejects an expired quote without reserving funds or mutating the request',async()=>{
    const card=await newRequest();
    await database().query("UPDATE generation_requests SET estimate_expires_at=now()-interval '1 second' WHERE id=$1 AND version=$2",[card.id,card.version]);
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    await expect(confirm(card)).rejects.toMatchObject({code:'ESTIMATE_STALE'});
    expect((await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version])).rows[0].status).toBe('pending');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[card.id])).rows[0].n).toBe('0');
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
  });
  it('rejects a first frame whose dimensions changed after card creation without reserving funds',async()=>{
    const imageId=randomUUID(),messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'参考图生成'})).id;
    await database().query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,metadata)
      VALUES($1,$2,'frame','image','ready',$3,1024,$4)`,[imageId,projectId,`${projectId}/${imageId}`,{mime:'image/png',width:640,height:360}]);
    const card=await createGenerationRequest(owner,projectId,requestInput(messageId,{referenceAssetId:imageId}));
    expect(card.estimate).toMatchObject({status:'ready',maxChargeCents:180});
    await database().query("UPDATE assets SET metadata=jsonb_set(metadata,'{height}','100'::jsonb) WHERE id=$1",[imageId]);
    const before=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    await expect(confirm(card)).rejects.toMatchObject({code:'REFERENCE_UNAVAILABLE'});
    expect((await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version])).rows[0].status).toBe('pending');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[card.id])).rows[0].n).toBe('0');
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
  });
  it('enforces remaining budget without partial job or ledger writes',async()=>{
    const card=await newRequest();process.env.VIDEO_PROJECT_BUDGET_CENTS='120';
    await expect(confirm(card)).rejects.toMatchObject({code:'VIDEO_BUDGET_EXCEEDED'});
    process.env.VIDEO_PROJECT_BUDGET_CENTS='1000';
    const {rows:[row]}=await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version]);expect(row.status).toBe('pending');
    expect((await database().query('SELECT 1 FROM generation_jobs WHERE request_id=$1',[card.id])).rowCount).toBe(0);
  });
  it('rolls back the job, request state and account when the reserve ledger insert fails',async()=>{
    const card=await newRequest(),commandId=randomUUID(),suffix=randomUUID().replaceAll('-','');
    const trigger=`qa_reserve_abort_${suffix}`,procedure=`qa_reserve_abort_fn_${suffix}`;
    const before=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    await database().query(`CREATE FUNCTION ${procedure}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.kind='reserve' AND EXISTS(SELECT 1 FROM generation_jobs WHERE id=NEW.job_id AND project_id='${projectId}'::uuid) THEN
          RAISE EXCEPTION 'qa_reserve_ledger_failure';
        END IF;
        RETURN NEW;
      END $$`);
    try{
      await database().query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON generation_usage_events FOR EACH ROW EXECUTE FUNCTION ${procedure}()`);
      await expect(confirm(card,commandId)).rejects.toThrow('qa_reserve_ledger_failure');
    }finally{
      await database().query(`DROP TRIGGER IF EXISTS ${trigger} ON generation_usage_events`);
      await database().query(`DROP FUNCTION IF EXISTS ${procedure}()`);
    }
    expect((await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version])).rows[0].status).toBe('pending');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[card.id])).rows[0].n).toBe('0');
    expect((await database().query('SELECT count(*) n FROM generation_confirmation_commands WHERE project_id=$1 AND command_id=$2',[projectId,commandId])).rows[0].n).toBe('0');
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
    const retry=await confirm(card,commandId);
    expect(retry).toMatchObject({status:'queued',reservedCents:120});
    expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='reserve'",[retry.id])).rows[0].n).toBe('1');
  });
  it('invalidates a proposal after connection rotation and serializes replace versus confirm',async()=>{
    const stale=await newRequest();
    await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:1,action:'save',config,credential:{action:'keep'}});
    await expect(confirm(stale)).rejects.toMatchObject({code:'VIDEO_CONNECTION_CHANGED'});
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'另一个视频'})).id;
    const card=await createGenerationRequest(owner,projectId,requestInput(messageId));
    const replacement=requestInput(messageId,{requestId:card.id,baseVersion:card.version,prompt:'替代描述'});
    const results=await Promise.allSettled([confirm(card),createGenerationRequest(owner,projectId,replacement)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect((await database().query('SELECT id FROM generation_jobs WHERE request_id=$1',[card.id])).rowCount).toBeLessThanOrEqual(1);
    const {rows}=await database().query('SELECT version,status FROM generation_requests WHERE id=$1 ORDER BY version',[card.id]);
    expect(rows[0].status==='submitted'||rows[0].status==='superseded').toBe(true);
  });
  it('does not reroute a pending default-connection card after the administrator changes the default',async()=>{
    const {rows:[old]}=await database().query<{current_version:number}>('SELECT current_version FROM model_connections WHERE id=$1',[connectionId]);
    await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:old.current_version,action:'save',config:{...config,isDefault:true},credential:{action:'keep'}});
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'默认连接切换测试'})).id;
    const card=await createGenerationRequest(owner,projectId,requestInput(messageId,{connectionId:undefined}));
    expect(card.context).toMatchObject({connectionSelection:'default'});
    expect(card.connectionId).toBe(connectionId);
    extraConnectionId=randomUUID();
    await mutateModelConnection(admin,{commandId:randomUUID(),id:extraConnectionId,baseVersion:0,action:'save',config:{...config,name:'新的默认连接',isDefault:true},credential:{action:'replace',value:`other-synthetic-${randomUUID()}`}});
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    await expect(confirm(card)).rejects.toMatchObject({code:'VIDEO_CONNECTION_CHANGED'});
    expect((await database().query('SELECT status FROM generation_requests WHERE id=$1 AND version=$2',[card.id,card.version])).rows[0].status).toBe('pending');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[card.id])).rows[0].n).toBe('0');
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
  });
});
