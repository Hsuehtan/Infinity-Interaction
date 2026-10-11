import {spawn} from 'node:child_process';

// Local uploads require both the web server and the non-billable media verifier.
// Keep their lifetimes together so a stopped worker cannot silently strand uploads.
const children=[
  spawn(process.execPath,['--env-file=.env.local','--import','tsx','scripts/generation-worker.ts'],{stdio:'inherit'}),
  spawn(process.execPath,['--env-file=.env.local','--import','tsx','scripts/media-worker.ts'],{stdio:'inherit'}),
  spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3100'],{stdio:'inherit'}),
];
let stopping=false;
function stop(code){
  if(stopping)return;
  stopping=true;process.exitCode=code;
  for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');
  const force=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');},5000);
  force.unref();
}
for(const child of children){
  child.on('error',error=>{console.error('Local development process failed:',error.message);stop(1);});
  child.on('exit',code=>{if(!stopping){console.error('A local development process stopped; stopping the companion process.');stop(code||1);}});
}
process.on('SIGINT',()=>stop(0));
process.on('SIGTERM',()=>stop(0));
