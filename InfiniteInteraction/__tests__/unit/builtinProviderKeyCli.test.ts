// @vitest-environment node
import {spawnSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';

const run=(args:string[])=>spawnSync(process.execPath,['--import','tsx','scripts/model-operations.ts','set-provider-key',...args],{
 encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://unreachable:unused@127.0.0.1:1/unreachable'},timeout:10000,
});

describe('account-free builtin credential command',()=>{
 it('reaches the hidden input without looking up a username or connecting to the database',()=>{
  const result=run(['runninghub']);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('交互式终端');
  expect(result.stderr).not.toMatch(/username|ECONNREFUSED/);
 });
 it('rejects the obsolete username argument and never prints extra arguments',()=>{
  const result=run(['unused-user','runninghub','synthetic-secret']);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('无需用户名');
  expect(result.stdout+result.stderr).not.toContain('synthetic-secret');
 });
});
