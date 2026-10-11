import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {describe,it,expect} from 'vitest';

describe('deployment credentials without actor migration',()=>{
 it('preserves legacy attribution and permits deployment credentials with no users',async()=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  const client=await pool.connect(),schema=`deployment_keys_${randomUUID().replaceAll('-','')}`;
  const migration='032_deployment_credentials_without_actor.sql';
  try{
   await client.query(`CREATE SCHEMA ${schema}`);
   await client.query(`SET search_path TO ${schema}`);
   const files=(await readdir(resolve('db/migrations'))).filter(name=>name.endsWith('.sql')).sort();
   for(const name of files.filter(name=>name<migration))await client.query(await readFile(resolve('db/migrations',name),'utf8'));
   const user=randomUUID(),credential=randomUUID();
   await client.query("INSERT INTO users(id,username,password_hash) VALUES($1,'legacy-user','fixture')",[user]);
   await client.query("INSERT INTO model_credentials(id,key_id,ciphertext,iv,tag,created_by) VALUES($1,'fixture',$2,$3,$4,$5)",[credential,Buffer.from('encrypted'),Buffer.alloc(12),Buffer.alloc(16),user]);
   await client.query("INSERT INTO builtin_provider_bindings(provider_key,version,credential_ref,created_by) VALUES('runninghub',1,$1,$2)",[credential,user]);
   const before={credentials:(await client.query('SELECT * FROM model_credentials')).rows,bindings:(await client.query('SELECT * FROM builtin_provider_bindings')).rows};
   const sql=await readFile(resolve('db/migrations',migration),'utf8');
   await client.query(sql);await client.query(sql);
   expect((await client.query('SELECT * FROM model_credentials')).rows).toEqual(before.credentials);
   expect((await client.query('SELECT * FROM builtin_provider_bindings')).rows).toEqual(before.bindings);
   await client.query('DELETE FROM builtin_provider_bindings');
   await client.query('DELETE FROM model_credentials');
   await client.query('DELETE FROM users');
   await client.query("INSERT INTO model_credentials(id,key_id,ciphertext,iv,tag) VALUES($1,'fixture',$2,$3,$4)",[credential,Buffer.from('encrypted'),Buffer.alloc(12),Buffer.alloc(16)]);
   await client.query("INSERT INTO builtin_provider_bindings(provider_key,version,credential_ref) VALUES('runninghub',1,$1)",[credential]);
   expect((await client.query('SELECT count(*) n FROM users')).rows[0].n).toBe('0');
   expect((await client.query('SELECT created_by FROM model_credentials')).rows[0].created_by).toBeNull();
   expect((await client.query('SELECT created_by FROM builtin_provider_bindings')).rows[0].created_by).toBeNull();
  }finally{
   await client.query('SET search_path TO public');
   await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
   client.release();await pool.end();
  }
 });
});
