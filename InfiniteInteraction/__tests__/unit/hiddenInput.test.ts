import {PassThrough} from 'node:stream';
import {describe,it,expect} from 'vitest';
import {readHiddenInput} from '../../scripts/lib/hidden-input';

function terminal(){
 const input=Object.assign(new PassThrough(),{isTTY:true}),output=Object.assign(new PassThrough(),{isTTY:true});
 let visible='';output.on('data',chunk=>{visible+=chunk.toString();});
 return {input,output,visible:()=>visible};
}
describe('hidden deployment credential input',()=>{
 it('accepts a pasted key without echoing it',async()=>{
  const tty=terminal(),pending=readHiddenInput('API Key: ',tty);
  tty.input.write('synthetic-runninghub-secret\r');
  expect(await pending).toBe('synthetic-runninghub-secret');
  expect(tty.visible()).toBe('API Key: \n');
 });
 it('cancels without exposing partially entered text',async()=>{
  const tty=terminal(),pending=readHiddenInput('API Key: ',tty);
  tty.input.write('partial-secret\u0003');
  await expect(pending).rejects.toThrow('已取消');
  expect(tty.visible()).not.toContain('partial-secret');
 });
 it('rejects non-interactive input without consuming a key',async()=>{
  const tty=terminal();tty.input.isTTY=false;
  await expect(readHiddenInput('API Key: ',tty)).rejects.toThrow('交互式终端');
  expect(tty.visible()).toBe('');
 });
 it('treats EOF as cancellation',async()=>{
  const tty=terminal(),pending=readHiddenInput('API Key: ',tty);
  tty.input.end();
  await expect(pending).rejects.toThrow('输入已结束');
 });
});
