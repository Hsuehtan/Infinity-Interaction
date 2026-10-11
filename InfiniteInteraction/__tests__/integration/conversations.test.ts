import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {provisionUser,type Actor} from '../../server/auth';
import {database} from '../../server/db';
import {createProject,getProject} from '../../server/projects';
import {readConversation,sendConversationMessage} from '../../server/conversations';

let owner:Actor,stranger:Actor,projectId:string,otherProjectId:string;
beforeAll(async()=>{owner=await provisionUser(`conversation-${randomUUID()}`,`Password-${randomUUID()}`);stranger=await provisionUser(`conversation-${randomUUID()}`,`Password-${randomUUID()}`);projectId=(await createProject(owner,'共享对话')).id;otherProjectId=(await createProject(stranger,'其他项目')).id;});
afterAll(async()=>{for(const id of [projectId,otherProjectId].filter(Boolean))await database().query('DELETE FROM projects WHERE id=$1',[id]);for(const actor of [owner,stranger].filter(Boolean))await database().query('DELETE FROM users WHERE id=$1',[actor.id]);await database().end();});

describe('真实 PostgreSQL · 项目共享对话',()=>{
  it('keeps one owner-scoped message stream and derives role and sequence on the server',async()=>{
    const requests=Array.from({length:4},(_,index)=>sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:`需求 ${index+1}`}));
    const sent=await Promise.all(requests);expect(new Set(sent.map(message=>message.sequence)).size).toBe(4);expect(sent.every(message=>message.role==='user')).toBe(true);
    const loaded=await readConversation(owner,projectId);expect(loaded.messages.map(message=>message.sequence)).toEqual([1,2,3,4]);expect(new Set(loaded.messages.map(message=>message.text))).toEqual(new Set(['需求 1','需求 2','需求 3','需求 4']));
    await expect(readConversation(stranger,projectId)).rejects.toMatchObject({status:404});await expect(sendConversationMessage(stranger,projectId,{clientMessageId:randomUUID(),text:'越权'})).rejects.toMatchObject({status:404});
    await expect(sendConversationMessage(owner,otherProjectId,{clientMessageId:randomUUID(),text:'越权'})).rejects.toMatchObject({status:404});
  });
  it('makes client message IDs idempotent and rejects role or payload substitution',async()=>{
    const clientMessageId=randomUUID(),input={clientMessageId,text:'同一条消息'};const first=await sendConversationMessage(owner,projectId,input),retry=await sendConversationMessage(owner,projectId,input);expect(retry).toEqual(first);
    await expect(sendConversationMessage(owner,projectId,{...input,text:'替换内容'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    await expect(sendConversationMessage(owner,projectId,{...input,clientMessageId:randomUUID(),role:'assistant'})).rejects.toMatchObject({code:'INVALID_MESSAGE'});
  });
  it('returns messages without a persisted composer draft and does not advance project revision',async()=>{
    const before=await getProject(owner,projectId);
    await expect(sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'不接受旧草稿版本',baseDraftRevision:0})).rejects.toMatchObject({code:'INVALID_MESSAGE'});
    await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'正式发送'});
    const loaded=await readConversation(owner,projectId);
    expect(loaded).not.toHaveProperty('draft');
    expect(loaded.messages.at(-1)?.text).toBe('正式发送');
    expect((await getProject(owner,projectId)).revision).toBe(before.revision);
  });
});
