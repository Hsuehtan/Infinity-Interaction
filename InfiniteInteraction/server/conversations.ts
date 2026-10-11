import {isGeneric} from './models/generic/generation';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from './auth';
import {database,transaction} from './db';
import {requireCondition} from './errors';
import {videoInputSchema} from '../shared/video-generation';
import {createGenerationRequestInTransaction} from './generation/requests';
import {enrichSelectedVideoMetadata} from './generation/media-policy';
import {imageInputSchema} from '../shared/image-generation';

const messageSchema=z.object({clientMessageId:z.uuid(),text:z.string().trim().min(1).max(20000),generation:z.record(z.string(),z.unknown()).optional()}).strict();
type MessageRow={id:string;client_message_id:string;sequence:string;role:'user'|'assistant';body:string;created_at:Date};
const messageView=(row:MessageRow)=>({id:row.id,clientMessageId:row.client_message_id,sequence:Number(row.sequence),role:row.role,text:row.body,createdAt:new Date(row.created_at).toISOString()});

export async function readConversation(actor:Actor,projectId:string){
  const project=await database().query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const messages=await database().query<MessageRow>('SELECT id,client_message_id,sequence,role,body,created_at FROM conversation_messages WHERE project_id=$1 ORDER BY sequence',[projectId]);
  return {projectId,messages:messages.rows.map(messageView)};
}
export async function sendConversationMessage(actor:Actor,projectId:string,input:unknown){
  const parsed=messageSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_MESSAGE','消息需为 1–20,000 个字符，且操作标识有效。');const request=parsed.data,requestHash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  if(request.generation){
    requireCondition(request.generation.prompt===request.text,400,'INVALID_GENERATION_REQUEST','消息和生成描述不一致。');
    // Request objects include command, target and connection fields; validate only generation fields here.
    const fields=request.generation;
    if(isGeneric(fields)){/* Generic schema and model rules are validated atomically when creating the card. */}
    else if(fields.outputKind==='image'){
      const image=imageInputSchema.safeParse({schemaVersion:fields.schemaVersion,mode:fields.mode,prompt:fields.prompt,resolution:fields.resolution,referenceAssetIds:fields.referenceAssetIds});
      requireCondition(image.success,400,'INVALID_GENERATION_REQUEST','图片模式或参数不正确。');
    }else{
      const video=videoInputSchema.safeParse({schemaVersion:fields.schemaVersion,mode:fields.mode,prompt:fields.prompt,duration:fields.duration,resolution:fields.resolution,ratio:fields.ratio,media:fields.media});
      requireCondition(video.success,400,'INVALID_GENERATION_REQUEST','视频模式或参数不正确。');
      const owner=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
      requireCondition(owner.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
      await enrichSelectedVideoMetadata(projectId,video.data);
    }
  }
  return transaction(async client=>{
    const project=await client.query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[existing]}=await client.query<MessageRow&{request_hash:string}>('SELECT * FROM conversation_messages WHERE project_id=$1 AND client_message_id=$2',[projectId,request.clientMessageId]);
    if(existing){requireCondition(existing.request_hash===requestHash,409,'IDEMPOTENCY_CONFLICT','相同消息标识不能发送不同内容。');
      if(request.generation){const card=await createGenerationRequestInTransaction(client,actor,projectId,{...request.generation,messageId:existing.id});return {...messageView(existing),request:card};}
      return messageView(existing);}
    const {rows:[row]}=await client.query<MessageRow>(`INSERT INTO conversation_messages(project_id,sequence,id,client_message_id,role,body,request_hash,created_by)
      SELECT $1,COALESCE(MAX(sequence),0)+1,$2,$3,'user',$4,$5,$6 FROM conversation_messages WHERE project_id=$1 RETURNING *`,[projectId,randomUUID(),request.clientMessageId,request.text,requestHash,actor.id]);
    const card=request.generation?await createGenerationRequestInTransaction(client,actor,projectId,{...request.generation,messageId:row.id}):undefined;
    return {...messageView(row),...(card?{request:card}:{})};
  });
}
