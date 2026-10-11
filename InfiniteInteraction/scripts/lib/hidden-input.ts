import {createInterface} from 'node:readline';
import {Writable,type Readable} from 'node:stream';

type Terminal={input:Readable&{isTTY?:boolean};output:Writable&{isTTY?:boolean}};

/** Read through a real terminal without echo, command arguments, or shell history. */
export function readHiddenInput(prompt:string,terminal:Terminal={input:process.stdin,output:process.stdout}):Promise<string>{
 const {input,output}=terminal;
 if(!input.isTTY||!output.isTTY)return Promise.reject(new Error('请在交互式终端中运行此命令，API Key 将隐藏输入。'));
 const muted=new Writable({write(_chunk,_encoding,done){done();}});
 const reader=createInterface({input,output:muted,terminal:true,historySize:0});
 output.write(prompt);
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error:Error|null,value='')=>{
   if(settled)return;
   settled=true;
   reader.close();
   muted.end();
   output.write('\n');
   if(error)reject(error);else resolve(value);
  };
  reader.once('SIGINT',()=>finish(new Error('已取消，未保存 API Key。')));
  reader.once('close',()=>finish(new Error('输入已结束，未保存 API Key。')));
  reader.question('',value=>finish(null,value));
 });
}
