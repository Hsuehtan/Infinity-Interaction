/** Disposable DB for integration verification. Never changes application runtime settings. */
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const mainUrl=new URL(process.env.DATABASE_URL!);const name=`ii_r_${randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:mainUrl.toString(),connectionTimeoutMillis:5000,query_timeout:15000});const isolated=new URL(mainUrl);isolated.pathname=`/${name}`;
function run(args:string[]){return new Promise<void>((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,DATABASE_URL:isolated.toString()}});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(new Error(`Test process exited ${code}`)));});}
async function main(){let created=false;try{await admin.query(`CREATE DATABASE "${name}"`);created=true;console.log('Created isolated integration database');await run(['--import','tsx','scripts/migrate.ts']);await run(['node_modules/vitest/vitest.mjs','run','--config','vitest.integration.config.mts',...process.argv.slice(2)]);}catch(e){console.error((e as Error).message);process.exitCode=1;}finally{if(created)await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await admin.end();console.log(created?'Removed isolated integration database':'Isolated database creation was not confirmed; integration checks did not run');}

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
