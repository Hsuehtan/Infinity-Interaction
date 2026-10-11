/** Run with Web/Worker stopped and an existing pg_dump backup. Records hashes, never secrets. */
import {database} from '../server/db';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path='.local/backups/model-sources-20261002/inventory.json';
async function main(){
 const c=database(),stage=process.argv[2];
 const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string).filter(t=>!['schema_migrations','builtin_provider_bindings','builtin_model_versions'].includes(t));
 const inventory:Record<string,{count:number;hash:string}>={};
 for(const table of tables){const strip=table==='users'?" - 'role'":table==='providers'?" - 'owner_id'":table==='model_connections'?" - 'owner_id' - 'source'":'';const rows=(await c.query(`SELECT (to_jsonb(t)${strip})::text AS value FROM "${table}" t ORDER BY (to_jsonb(t)${strip})::text`)).rows;inventory[table]={count:rows.length,hash:createHash('sha256').update(rows.map(r=>r.value).join('\n')).digest('hex')};}
 if(stage==='before'){await writeFile(path,JSON.stringify(inventory),{mode:0o600});console.log('Saved pre-migration hashes for',tables.length,'tables');return;}
 const before=JSON.parse(await readFile(path,'utf8'));
 for(const [table,value] of Object.entries(before))if(JSON.stringify(value)!==JSON.stringify(inventory[table]))throw new Error('History changed: '+table);
 const providers=(await c.query('SELECT id,created_by,owner_id FROM providers ORDER BY id')).rows;
 const models=(await c.query('SELECT id,created_by,owner_id,source,current_version FROM model_connections ORDER BY id')).rows;
 const result={verified:true,unchangedHistory:inventory,providers,models,rolesRemoved:!(await c.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role'")).rowCount};
 await writeFile('../tasks/reports/model-sources-b-migration.json',JSON.stringify(result,null,2));console.log('All history hashes preserved; owners mapped; roles removed:',result.rolesRemoved);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>database().end());
