import {lookup as dnsLookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {Agent as HttpsAgent,request as httpsRequest} from 'node:https';
import {connect as tlsConnect} from 'node:tls';
import {AppError,requireCondition} from '../errors';

type Address={address:string;family:4|6};
type RawResponse={status:number;headers:Record<string,string|undefined>;body:Uint8Array};
export type SafeRequestInput={url:string;method:'GET'|'POST'|'PUT'|'PATCH';headers?:Record<string,string>;body?:Uint8Array;allowedOrigins:string[];maxBytes?:number;timeoutMs?:number;maxRedirects?:number;additionalAllowedHeaders?:string[];authenticated?:boolean};
type Dependencies={lookup(hostname:string):Promise<Address[]>;request(url:URL,address:Address,input:Required<Pick<SafeRequestInput,'method'|'maxBytes'|'timeoutMs'>>&Pick<SafeRequestInput,'headers'|'body'>):Promise<RawResponse>};

const blocked=new BlockList();
for(const [network,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(network,prefix,'ipv4');
// Reject transition prefixes that can route an encoded private IPv4 destination.
for(const [network,prefix] of [['::',128],['::1',128],['64:ff9b::',96],['64:ff9b:1::',48],['fc00::',7],['fe80::',10],['ff00::',8],['2001::',32],['2001:db8::',32],['2002::',16]] as const)blocked.addSubnet(network,prefix,'ipv6');
const allowedHeaders=new Set(['accept','authorization','content-type','idempotency-key','user-agent']);
function publicAddress(value:Address){
  const address=value.address.toLowerCase(),mapped=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if(mapped)return !blocked.check(mapped[1],'ipv4');
  return isIP(address)===value.family&&!blocked.check(address,value.family===4?'ipv4':'ipv6');
}
export async function resolvePublicAddresses(hostname:string,lookup:Dependencies['lookup']=async host=>(await dnsLookup(host,{all:true,verbatim:true})) as Address[],timeoutMs=10_000){
  requireCondition(!isIP(hostname)&&hostname.includes('.')&&!/(^|\.)(localhost|local|internal)$/.test(hostname.toLowerCase()),400,'UNSAFE_DESTINATION','出站目标域名不受支持。');
  let timer:ReturnType<typeof setTimeout>|undefined;
  let addresses:Address[];
  try{addresses=await Promise.race([Promise.resolve().then(()=>lookup(hostname)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AppError(504,'DESTINATION_TIMEOUT','供应商域名解析超时。')),timeoutMs);})]);}
  catch(error){if(error instanceof AppError)throw error;throw new AppError(502,'DESTINATION_UNAVAILABLE','供应商域名暂时无法解析。');}
  finally{if(timer)clearTimeout(timer);}
  requireCondition(addresses.length>0&&addresses.length<=16&&addresses.every(publicAddress),400,'UNSAFE_DESTINATION','出站目标解析到不允许的网络地址。');return addresses;
}
/** Agent owns the connection so Node cannot resolve the hostname a second time after validation. */
export function createPinnedHttpsAgent(url:URL,address:Address,connect:typeof tlsConnect=tlsConnect){
  const agent=new HttpsAgent({keepAlive:false});
  agent.createConnection=()=>connect({host:address.address,port:Number(url.port||443),servername:url.hostname,rejectUnauthorized:true});
  return agent;
}
async function requestOnce(url:URL,address:Address,input:Required<Pick<SafeRequestInput,'method'|'maxBytes'|'timeoutMs'>>&Pick<SafeRequestInput,'headers'|'body'>):Promise<RawResponse>{
  return new Promise((resolve,reject)=>{
    const chunks:Buffer[]=[];let size=0,settled=false;
    const agent=createPinnedHttpsAgent(url,address);
    let timer:ReturnType<typeof setTimeout>|undefined;
    const finish=()=>{if(settled)return false;settled=true;if(timer)clearTimeout(timer);agent.destroy();return true;};
    const fail=(error:unknown)=>{if(!finish())return;reject(error instanceof AppError?error:new AppError(502,'PROVIDER_UNAVAILABLE','供应商请求失败。'));};
    const request=httpsRequest({protocol:'https:',hostname:url.hostname,port:url.port||443,path:`${url.pathname}${url.search}`,method:input.method,headers:{...input.headers,...(input.body?{'content-length':String(input.body.length)}:{})},agent},response=>{
      response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>input.maxBytes){response.destroy(new AppError(413,'PROVIDER_RESPONSE_TOO_LARGE','供应商响应超过大小限制。'));return;}chunks.push(chunk);});
      response.on('error',fail);response.on('end',()=>{if(!finish())return;const headers:Record<string,string|undefined>={};for(const [key,value] of Object.entries(response.headers))headers[key]=Array.isArray(value)?value.join(', '):value;resolve({status:response.statusCode??502,headers,body:Buffer.concat(chunks)});});
    });
    timer=setTimeout(()=>request.destroy(new AppError(504,'PROVIDER_TIMEOUT','供应商请求超时。')),input.timeoutMs);
    request.on('error',fail);if(input.body)request.write(input.body);request.end();
  });
}
const productionDependencies:Dependencies={lookup:async hostname=>(await dnsLookup(hostname,{all:true,verbatim:true})) as Address[],request:requestOnce};
export function createSafeRequester(dependencies:Dependencies=productionDependencies){return async(input:SafeRequestInput):Promise<RawResponse>=>{
  const maxBytes=input.maxBytes??10_000_000,timeoutMs=input.timeoutMs??30_000,maxRedirects=input.maxRedirects??3;
  requireCondition(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=200_000_000&&Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=120_000&&Number.isInteger(maxRedirects)&&maxRedirects>=0&&maxRedirects<=5,500,'INVALID_NETWORK_POLICY','出站请求限制配置无效。');
  const deadline=performance.now()+timeoutMs;
  const remaining=()=>{
    const milliseconds=Math.floor(deadline-performance.now());
    requireCondition(milliseconds>0,504,'PROVIDER_TIMEOUT','供应商请求超时。');
    return milliseconds;
  };
  const headers:Record<string,string>={};for(const [key,value] of Object.entries(input.headers??{})){const normalized=key.toLowerCase();requireCondition((allowedHeaders.has(normalized)||input.additionalAllowedHeaders?.some(name=>name.toLowerCase()===normalized))&&!['host','content-length','connection','cookie','set-cookie','transfer-encoding','proxy-authorization'].includes(normalized)&&/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(key)&&!/[\r\n]/.test(value),400,'UNSAFE_HEADER','出站请求包含不允许的请求头。');headers[normalized]=value;}
  let url:URL;try{url=new URL(input.url);}catch{throw new AppError(400,'UNSAFE_DESTINATION','出站目标格式不正确。');}
  const initialOrigin=url.origin;
  let bytesRemaining=maxBytes;
  for(let redirect=0;redirect<=maxRedirects;redirect++){
    requireCondition(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&input.allowedOrigins.includes(url.origin),400,'UNSAFE_DESTINATION','出站目标不在部署白名单中。');
    if(headers.authorization||input.authenticated)requireCondition(url.origin===initialOrigin,400,'UNSAFE_REDIRECT','认证请求不能跨域重定向。');
    const addresses=await resolvePublicAddresses(url.hostname,dependencies.lookup,Math.min(remaining(),10_000)),address=addresses[redirect%addresses.length];
    requireCondition(bytesRemaining>0,413,'PROVIDER_RESPONSE_TOO_LARGE','供应商响应超过大小限制。');
    const response=await dependencies.request(url,address,{method:input.method,headers,body:input.body,maxBytes:bytesRemaining,timeoutMs:remaining()});remaining();requireCondition(response.body.length<=bytesRemaining,413,'PROVIDER_RESPONSE_TOO_LARGE','供应商响应超过大小限制。');
    bytesRemaining-=response.body.length;
    if(![301,302,303,307,308].includes(response.status))return response;
    requireCondition(redirect<maxRedirects,502,'TOO_MANY_REDIRECTS','供应商重定向次数过多。');
    requireCondition(input.method==='GET'||[307,308].includes(response.status),400,'UNSAFE_REDIRECT','供应商返回了不安全的方法重定向。');
    const location=response.headers.location;requireCondition(location,502,'INVALID_REDIRECT','供应商重定向缺少目标。');try{url=new URL(location,url);}catch{throw new AppError(502,'INVALID_REDIRECT','供应商重定向目标无效。');}
  }
  throw new AppError(502,'TOO_MANY_REDIRECTS','供应商重定向次数过多。');
};}
export const safeRequest=createSafeRequester();
