import {createHash} from 'node:crypto';
import type {Actor} from '../auth';
import {transaction} from '../db';
import {requireCondition} from '../errors';
import {buildRequestSchema} from '../../shared/publishing';
export async function requestBuild(actor:Actor,projectId:string,versionId:string,input:unknown){
  const parsed=buildRequestSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_BUILD','请确认分享范围后再提交发布。');
  const request=parsed.data,hash=createHash('sha256').update(JSON.stringify({versionId,...request})).digest('hex');
  return transaction(async client=>{
    const {rows:[version]}=await client.query('SELECT v.id,v.status FROM published_versions v JOIN projects p ON p.id=v.project_id WHERE v.id=$1 AND v.project_id=$2 AND p.owner_id=$3 FOR UPDATE OF v',[versionId,projectId,actor.id]);
    requireCondition(version,404,'VERSION_NOT_FOUND','版本不存在或没有访问权限。');
    const {rows:[prior]}=await client.query('SELECT * FROM publish_build_commands WHERE project_id=$1 AND command_id=$2',[projectId,request.commandId]);
    if(prior){requireCondition(prior.request_hash===hash&&prior.actor_id===actor.id,409,'IDEMPOTENCY_CONFLICT','相同操作标识不能提交不同发布内容。');return {versionId,generation:prior.generation};}
    const {rows:[build]}=await client.query('SELECT * FROM publish_builds WHERE version_id=$1 FOR UPDATE',[versionId]);
    requireCondition((build?.generation??0)===request.baseGeneration,409,'BUILD_CONFLICT','构建状态已变化，请刷新版本列表后重试。');
    requireCondition(version.status==='pending'||version.status==='failed',409,'BUILD_ACTIVE','此版本正在构建或已发布，无需重复提交。');
    const generation=(build?.generation??0)+1;
    await client.query(`INSERT INTO publish_builds(version_id,generation,status,share_scope,confirmed_by) VALUES($1,$2,'queued','unlisted',$3)
      ON CONFLICT(version_id) DO UPDATE SET generation=$2,status='queued',confirmed_by=$3,confirmed_at=now(),attempts=0,lease_token=NULL,lease_until=NULL,artifact_key=NULL,artifact_hash=NULL,completed_at=NULL`,[versionId,generation,actor.id]);
    await client.query("UPDATE published_versions SET status='building',error=NULL WHERE id=$1",[versionId]);
    await client.query('INSERT INTO publish_build_commands(project_id,command_id,version_id,request_hash,actor_id,generation) VALUES($1,$2,$3,$4,$5,$6)',[projectId,request.commandId,versionId,hash,actor.id,generation]);
    return {versionId,generation};
  });
}
