import {afterEach,expect,it,vi} from 'vitest';
import {api} from '../../app/infinite/client';
import {uploadAndWait} from '../../app/infinite/media-client';
vi.mock('../../app/infinite/client',()=>({api:vi.fn()}));
const asset={id:'asset',name:'image.png',type:'image',status:'pending'};
const file=()=>new File(['image'],'image.png',{type:'image/png'});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.mocked(api).mockReset();sessionStorage.clear();});
it('distinguishes uploaded verification from transfer and returns the ready file',async()=>{
  vi.useFakeTimers();
  vi.mocked(api).mockResolvedValueOnce(asset).mockResolvedValueOnce({...asset,status:'processing'}).mockResolvedValueOnce({assets:[{...asset,status:'ready'}]});
  const progress=vi.fn(),pending=uploadAndWait('project',file(),progress);
  await vi.advanceTimersByTimeAsync(1200);
  expect(await pending).toMatchObject({status:'ready'});expect(progress).toHaveBeenCalledWith('已上传，正在核验…');
});
it('aborts waiting immediately when the form closes',async()=>{
  vi.useFakeTimers();const controller=new AbortController();
  vi.mocked(api).mockResolvedValue({...asset,status:'processing'});
  const result=uploadAndWait('project',file(),undefined,controller.signal).catch(error=>error);
  await vi.advanceTimersByTimeAsync(0);controller.abort();
  expect(await result).toBeDefined();expect(vi.mocked(api)).toHaveBeenCalledTimes(1);
});
it('bounds a hung upload request instead of keeping the form busy forever',async()=>{
  vi.useFakeTimers();
  vi.mocked(api).mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})));
  const outcome=uploadAndWait('project',file()).catch(error=>error);
  await vi.advanceTimersByTimeAsync(15_000);expect((await outcome).message).toContain('响应超时');
});
it('stops an endless verification queue with a recoverable error',async()=>{
  vi.useFakeTimers();
  vi.mocked(api).mockResolvedValueOnce({...asset,status:'processing'}).mockResolvedValue({assets:[{...asset,status:'processing'}]});
  const outcome=uploadAndWait('project',file()).catch(error=>error);
  await vi.advanceTimersByTimeAsync(180_000);
  expect((await outcome).message).toContain('等待素材核验超时');
  expect(vi.getTimerCount()).toBe(0);
});
