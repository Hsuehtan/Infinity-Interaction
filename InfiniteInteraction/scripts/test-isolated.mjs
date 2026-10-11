/** Full DB/storage tests in a disposable database; never attach a live Worker. */
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const admin=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
const name=`ii_test_${randomUUID().replaceAll('-','')}`,url=new URL(process.env.DATABASE_URL);url.pathname=`/${name}`;
const env={...process.env,DATABASE_URL:url.toString()};
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Check exited ${code}`)));});
let created=false;
try{await admin.query(`CREATE DATABASE "${name}"`);created=true;await run(['--import','tsx','scripts/migrate.ts']);await run(['node_modules/vitest/vitest.mjs','run','--config','vitest.integration.config.mts',...process.argv.slice(2)]);}
catch(e){console.error(e.message);process.exitCode=1;}
finally{if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
