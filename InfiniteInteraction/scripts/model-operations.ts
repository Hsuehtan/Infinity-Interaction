/** Local-only operations. No HTTP endpoint grants this process-local capability. */
import {readFile} from 'node:fs/promises';
import {database} from '../server/db';
import {operatorActor} from '../server/operations';
import {runtime,saveRuntime} from '../server/models/generic/service';
import {bindBuiltinProvider} from '../server/models/adapters/resolver';
import {setBuiltinProviderKey} from './lib/builtin-provider-key';
import {activeAdapters} from '../server/models/adapters/registry';
import {readHiddenInput} from './lib/hidden-input';
import {unknownGeneric,reconcileGeneric} from '../server/models/generic/reconcile';
import {listUnknownGenerationJobs,reconcileUnknownGeneration} from '../server/generation/reconcile';
import {listUnknownImageJobs,reconcileUnknownImage} from '../server/generation/image-reconcile';
import {listPendingGenerationBilling,reconcileGenerationBilling} from '../server/generation/billing';

async function main(){
 const [operation,...args]=process.argv.slice(2);
 if(operation==='set-provider-key'){
  if(args.length!==1)throw new Error('Usage: model-operations set-provider-key <provider-key>（无需用户名，API Key 请在提示后输入，不要放入命令参数）');
  const [providerKey]=args;
  if(!activeAdapters.some(adapter=>adapter.providerKey===providerKey))throw new Error('未知内置供应商');
  const result=await setBuiltinProviderKey(providerKey,await readHiddenInput(`${providerKey} API Key（输入不显示，Enter 保存，Ctrl+C 取消）：`));
  console.log(JSON.stringify(result,null,2));
  return;
 }
 const [username,arg,extra]=args;
 const {rows:[user]}=await database().query('SELECT id,username FROM users WHERE username=$1',[username]);
 if(!user)throw new Error('Specify an existing audit username');const actor=operatorActor(user);
 const input=async()=>JSON.parse(await readFile(arg,'utf8'));
 let result:unknown;
 switch(operation){
  case 'runtime':result=await runtime();break;
  case 'set-runtime':result=await saveRuntime(actor,await input());break;
  case 'bind-provider':result=await bindBuiltinProvider(actor,arg,extra);break;
  case 'pending':result={generic:await unknownGeneric(actor),video:await listUnknownGenerationJobs(actor),image:await listUnknownImageJobs(actor),billing:await listPendingGenerationBilling(actor)};break;
  case 'reconcile-generic':result=await reconcileGeneric(actor,await input());break;
  case 'reconcile-video':result=await reconcileUnknownGeneration(actor,await input());break;
  case 'reconcile-image':result=await reconcileUnknownImage(actor,await input());break;
  case 'billing':result=await reconcileGenerationBilling(actor,await input());break;
  default:throw new Error('Usage: model-operations set-provider-key <provider-key> | model-operations <runtime|set-runtime|bind-provider|pending|reconcile-generic|reconcile-video|reconcile-image|billing> <audit-username> [json-file | provider-key source-provider-id]');
 }
 console.log(JSON.stringify(result,null,2));
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Operation failed');process.exitCode=1;}).finally(()=>database().end());
