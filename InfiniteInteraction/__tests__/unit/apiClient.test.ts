import {afterEach,describe,expect,it,vi} from 'vitest';
import {api,apiForm} from '../../app/infinite/client';

afterEach(()=>{vi.unstubAllGlobals();});

describe('浏览器会话失效通知',()=>{
  it('notifies the workbench on JSON and form 401 responses without swallowing the public error',async()=>{
    const listener=vi.fn();window.addEventListener('interaction:auth-required',listener);
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({code:'UNAUTHENTICATED',error:'登录已过期。'}),{status:401,headers:{'Content-Type':'application/json'}})));
    await expect(api('/api/projects')).rejects.toMatchObject({status:401,code:'UNAUTHENTICATED'});
    await expect(apiForm('/api/projects/imports/preview',new FormData())).rejects.toMatchObject({status:401,code:'UNAUTHENTICATED'});
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('interaction:auth-required',listener);
  });
});
