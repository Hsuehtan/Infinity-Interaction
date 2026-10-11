import {createHash,randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {describe,expect,it} from 'vitest';

describe('persistent draft removal migration',()=>{
  it('builds a fresh schema and removes only obsolete draft data on upgrade',async()=>{
    const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
    const client=await pool.connect(),schema=`draft_cleanup_${randomUUID().replaceAll('-','')}`;
    try{
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      const migrations=(await readdir(resolve('db/migrations'))).filter(name=>name.endsWith('.sql')).sort();
      for(const name of migrations){
        if(name==='031_remove_persistent_drafts.sql'){
          const userId=randomUUID(),projectId=randomUUID(),messageId=randomUUID();
          await client.query("INSERT INTO users(id,username,password_hash) VALUES($1,$2,'hash')",[userId,`draft-${userId}`]);
          await client.query("INSERT INTO projects(id,owner_id,title,document) VALUES($1,$2,'保留项目','{}')",[projectId,userId]);
          await client.query("INSERT INTO conversation_messages(project_id,sequence,id,client_message_id,role,body,request_hash,created_by) VALUES($1,1,$2,$3,'user','保留消息',$4,$5)",[projectId,messageId,randomUUID(),createHash('sha256').update('message').digest('hex'),userId]);
          await client.query("INSERT INTO conversation_drafts(project_id,revision,body,updated_by) VALUES($1,1,'淘汰草稿',$2)",[projectId,userId]);
          await client.query("INSERT INTO conversation_draft_commands(project_id,command_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,'{}')",[projectId,randomUUID(),userId,createHash('sha256').update('draft').digest('hex')]);
        }
        await client.query(await readFile(resolve('db/migrations',name),'utf8'));
      }
      expect((await client.query("SELECT to_regclass('conversation_drafts') draft,to_regclass('conversation_draft_commands') commands")).rows[0]).toEqual({draft:null,commands:null});
      expect((await client.query('SELECT title FROM projects')).rows).toEqual([{title:'保留项目'}]);
      expect((await client.query('SELECT body FROM conversation_messages')).rows).toEqual([{body:'保留消息'}]);
    }finally{
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      client.release();await pool.end();
    }
  });
});
