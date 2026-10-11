import {describe,expect,it,vi} from 'vitest';
import {createPinnedHttpsAgent,createSafeRequester,resolvePublicAddresses} from '../../server/network/safe-request';
const publicAddress=[{address:'93.184.216.34',family:4 as const}];
describe('pinned outbound request policy',()=>{
  it('binds the HTTPS socket to the vetted address while preserving hostname verification',()=>{
    const connect=vi.fn(()=>({}));
    const agent=createPinnedHttpsAgent(new URL('https://video.example.test:443/result'),publicAddress[0],connect as never);
    agent.createConnection({host:'untrusted.example.test',port:9443});
    expect(connect).toHaveBeenCalledWith({host:'93.184.216.34',port:443,servername:'video.example.test',rejectUnauthorized:true});
    agent.destroy();
  });
  it('rejects private, loopback, link-local, mapped and mixed DNS answers',async()=>{
    for(const addresses of [
      [{address:'127.0.0.1',family:4 as const}],[{address:'169.254.169.254',family:4 as const}],
      [{address:'240.0.0.1',family:4 as const}],[{address:'255.255.255.255',family:4 as const}],
      [{address:'::1',family:6 as const}],[{address:'::ffff:127.0.0.1',family:6 as const}],
      [{address:'::ffff:7f00:1',family:6 as const}],[{address:'64:ff9b::a00:1',family:6 as const}],
      [{address:'64:ff9b:1::a00:1',family:6 as const}],[{address:'2002:0a00:0001::',family:6 as const}],
      [...publicAddress,{address:'10.0.0.1',family:4 as const}],
    ])await expect(resolvePublicAddresses('video.example.test',async()=>addresses)).rejects.toMatchObject({code:'UNSAFE_DESTINATION'});
    expect(await resolvePublicAddresses('video.example.test',async()=>[{address:'2606:4700:4700::1111',family:6}])).toEqual([{address:'2606:4700:4700::1111',family:6}]);
  });
  it('stops waiting for a stalled DNS lookup before attempting any connection',async()=>{
    await expect(resolvePublicAddresses('video.example.test',()=>new Promise(()=>{}),25)).rejects.toMatchObject({code:'DESTINATION_TIMEOUT'});
  });
  it('pins each hop, revalidates redirects and refuses credential forwarding across origins',async()=>{
    const lookup=vi.fn(async host=>host==='private.example.test'?[{address:'10.0.0.1',family:4 as const}]:publicAddress),request=vi.fn(async()=>({status:307,headers:{location:'https://private.example.test/result'},body:new Uint8Array()}));
    const safe=createSafeRequester({lookup,request});await expect(safe({url:'https://video.example.test/create',method:'POST',headers:{authorization:'Bearer redacted'},body:new Uint8Array([1]),allowedOrigins:['https://video.example.test','https://private.example.test']})).rejects.toMatchObject({code:'UNSAFE_REDIRECT'});expect(request).toHaveBeenCalledTimes(1);
    let calls=0;const rebound=createSafeRequester({lookup:async()=>++calls===1?publicAddress:[{address:'127.0.0.1',family:4}],request:async()=>({status:307,headers:{location:'/result'},body:new Uint8Array()})});
    await expect(rebound({url:'https://video.example.test/start',method:'GET',allowedOrigins:['https://video.example.test']})).rejects.toMatchObject({code:'UNSAFE_DESTINATION'});expect(calls).toBe(2);
  });
  it('allows bounded same-origin 307 and rejects header, method-redirect and oversized responses',async()=>{
    const lookup=vi.fn(async()=>publicAddress),request=vi.fn().mockResolvedValueOnce({status:307,headers:{location:'/result'},body:new Uint8Array()}).mockResolvedValueOnce({status:200,headers:{'content-type':'application/json'},body:new Uint8Array([1,2])});
    const safe=createSafeRequester({lookup,request});expect(await safe({url:'https://video.example.test/create',method:'POST',headers:{'idempotency-key':'one'},body:new Uint8Array([1]),allowedOrigins:['https://video.example.test'],maxBytes:10})).toMatchObject({status:200,body:new Uint8Array([1,2])});expect(request).toHaveBeenCalledTimes(2);
    await expect(safe({url:'https://video.example.test',method:'GET',headers:{cookie:'secret'},allowedOrigins:['https://video.example.test']})).rejects.toMatchObject({code:'UNSAFE_HEADER'});
    const convert=createSafeRequester({lookup,request:async()=>({status:302,headers:{location:'/result'},body:new Uint8Array()})});await expect(convert({url:'https://video.example.test',method:'POST',allowedOrigins:['https://video.example.test']})).rejects.toMatchObject({code:'UNSAFE_REDIRECT'});
    const large=createSafeRequester({lookup,request:async()=>({status:200,headers:{},body:new Uint8Array(11)})});await expect(large({url:'https://video.example.test',method:'GET',allowedOrigins:['https://video.example.test'],maxBytes:10})).rejects.toMatchObject({code:'PROVIDER_RESPONSE_TOO_LARGE'});
  });
  it('uses one wall-clock timeout budget across DNS and redirects',async()=>{
    const observedTimeouts:number[]=[];
    const request=vi.fn(async(_url:URL,_address:{address:string;family:4|6},options:{timeoutMs:number})=>{
      observedTimeouts.push(options.timeoutMs);
      await new Promise(resolve=>setTimeout(resolve,75));
      return {status:307,headers:{location:'/next'},body:new Uint8Array()};
    });
    const safe=createSafeRequester({lookup:async()=>publicAddress,request});
    await expect(safe({url:'https://video.example.test/start',method:'GET',allowedOrigins:['https://video.example.test'],timeoutMs:100})).rejects.toMatchObject({code:'PROVIDER_TIMEOUT'});
    expect(request).toHaveBeenCalledTimes(2);
    expect(observedTimeouts[1]).toBeLessThan(observedTimeouts[0]);
  });
  it('counts redirect bodies against the total response size limit',async()=>{
    const observedLimits:number[]=[];
    const request=vi.fn(async(_url:URL,_address:{address:string;family:4|6},options:{maxBytes:number})=>{
      observedLimits.push(options.maxBytes);
      return observedLimits.length===1?{status:307,headers:{location:'/next'},body:new Uint8Array(6)}:{status:200,headers:{},body:new Uint8Array(5)};
    });
    const safe=createSafeRequester({lookup:async()=>publicAddress,request});
    await expect(safe({url:'https://video.example.test/start',method:'GET',allowedOrigins:['https://video.example.test'],maxBytes:10})).rejects.toMatchObject({code:'PROVIDER_RESPONSE_TOO_LARGE'});
    expect(request).toHaveBeenCalledTimes(2);
    expect(observedLimits).toEqual([10,4]);
  });
});

it('protects custom credential headers across redirects and blocks unsafe allowlist additions',async()=>{
 const request=vi.fn(async()=>({status:307,headers:{location:'https://other.example.test/result'},body:new Uint8Array()}));
 const safe=createSafeRequester({lookup:async()=>publicAddress,request});
 await expect(safe({url:'https://source.example.test',method:'GET',authenticated:true,headers:{'x-api-key':'synthetic'},additionalAllowedHeaders:['x-api-key'],allowedOrigins:['https://source.example.test','https://other.example.test']})).rejects.toMatchObject({code:'UNSAFE_REDIRECT'});
 expect(request).toHaveBeenCalledTimes(1);
 await expect(safe({url:'https://source.example.test',method:'GET',headers:{host:'evil'},additionalAllowedHeaders:['host'],allowedOrigins:['https://source.example.test']})).rejects.toMatchObject({code:'UNSAFE_HEADER'});
});
