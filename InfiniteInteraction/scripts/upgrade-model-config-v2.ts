/** Append equivalent current model versions; never rewrite history or runtime controls. */
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {database,transaction} from '../server/db';
import {upgradeDefinition} from '../shared/generic/upgrade';
import {modelSql,digest} from '../server/models/generic/service';
const dir='.local/model-config-v2';
async function run(){await mkdir(dir,{recursive:true,mode:0o700});const rows=(await database().query(`${modelSql} WHERE c.archived_at IS NULL`)).rows;
 const current=rows.map(r=>({id:r.id,version:r.current_version,config:r.config,providerId:r.provider_id,definition:r.definition}));const file=`${dir}/${Date.now()}-${randomUUID()}.json`;await writeFile(file,JSON.stringify(current,null,2),{mode:0o600});
 const report=await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(81624002)');const report=[];for(const row of rows){if(row.definition.version===2){report.push({id:row.id,version:row.current_version,status:'already-v2'});continue;}const d=upgradeDefinition(row.definition);const {rows:[locked]}=await c.query('SELECT current_version FROM model_connections WHERE id=$1 FOR UPDATE',[row.id]);if(locked.current_version!==row.current_version)throw new Error('模型版本已变化，请重试升级');const v=row.current_version+1;await c.query('INSERT INTO model_connection_versions(connection_id,version,config,credential_ref,created_by) SELECT connection_id,$2,config,credential_ref,created_by FROM model_connection_versions WHERE connection_id=$1 AND version=$3',[row.id,v,row.current_version]);await c.query('INSERT INTO managed_model_versions(model_id,version,provider_id,definition) VALUES($1,$2,$3,$4)',[row.id,v,row.provider_id,d]);await c.query('UPDATE model_connections SET current_version=$2,updated_at=now() WHERE id=$1',[row.id,v]);report.push({id:row.id,previousVersion:row.current_version,version:v,previousDefinitionHash:digest(row.definition),definitionHash:digest(d),status:'upgraded'});}return report;});console.log(JSON.stringify({backup:file,models:report},null,2));}
run().catch(e=>{console.error((e as Error).message);process.exitCode=1;}).finally(()=>database().end());
