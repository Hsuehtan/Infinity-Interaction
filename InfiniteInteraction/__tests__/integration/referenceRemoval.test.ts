import {readFile} from 'node:fs/promises';
import {afterAll,expect,it} from 'vitest';
import {database,transaction} from '../../server/db';

afterAll(async()=>{await database().end();});
it('removes only retired relationship history steps and leaves project data and other undo entries intact',async()=>{
  const migration=await readFile('db/migrations/026_remove_reference_relations.sql','utf8');
  await transaction(async client=>{
    await client.query('CREATE TEMP TABLE projects(id text, document jsonb, undo_stack jsonb, redo_stack jsonb) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE commands(project_id text,command_id text,before_document jsonb,after_document jsonb,before_relations jsonb,after_relations jsonb) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE reference_relations(project_id text) ON COMMIT DROP');
    await client.query(`INSERT INTO projects VALUES('p','{"references":[{"id":"keep"}]}','["edit","link","mixed"]','["link","edit"]');
      INSERT INTO commands VALUES
      ('p','edit','{}','{"title":"new"}',NULL,NULL),
      ('p','link','{}','{}','[]','[{"endpointLow":"a","endpointHigh":"b"}]'),
      ('p','mixed','{}','{"title":"both"}','[]','[{"endpointLow":"a","endpointHigh":"b"}]')`);
    await client.query(migration);
    expect((await client.query('SELECT document,undo_stack,redo_stack FROM projects')).rows[0]).toEqual({document:{references:[{id:'keep'}]},undo_stack:['edit','mixed'],redo_stack:['edit']});
    expect((await client.query('SELECT count(*)::int n FROM commands')).rows[0].n).toBe(3);
    expect((await client.query("SELECT attname FROM pg_attribute WHERE attrelid='pg_temp.commands'::regclass AND attnum>0 AND NOT attisdropped")).rows.map(row=>row.attname)).not.toContain('before_relations');
  });
});
it('has no active relationship database objects after migration',async()=>{
  expect((await database().query("SELECT to_regclass('public.reference_relations') AS table_name")).rows[0].table_name).toBeNull();
  expect((await database().query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='commands' AND column_name IN ('before_relations','after_relations')")).rows).toEqual([]);
});
