import {afterEach,describe,expect,it} from 'vitest';
import {estimateVideo,hasActiveVideoPriceContract,samePriceContract} from '../../server/generation/pricing';

const prior=process.env.VIDEO_PRICE_CONTRACT_JSON;
const now=new Date('2026-09-26T04:00:00.000Z');
const input={duration:5,resolution:'768P' as const,ratio:'16:9' as const,referenceAssetId:null};
const contract=(price=120)=>({id:'test-contract',currency:'CNY',source:'integration fixture',reviewedAt:'2026-09-25T00:00:00.000Z',validUntil:'2026-10-01T00:00:00.000Z',entries:[{mode:'text',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:price}]});
afterEach(()=>{if(prior===undefined)delete process.env.VIDEO_PRICE_CONTRACT_JSON;else process.env.VIDEO_PRICE_CONTRACT_JSON=prior;});

describe('account-specific video price contract',()=>{
  it('quotes only an exact reviewed combination with a bounded lifetime',()=>{
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify(contract());
    const quote=estimateVideo(input,now);
    expect(quote).toMatchObject({status:'ready',maxChargeCents:120,contractId:'test-contract',expiresAt:'2026-09-26T04:30:00.000Z'});
    expect(estimateVideo({...input,ratio:'9:16'},now)).toMatchObject({status:'unavailable',reason:'PRICE_NOT_CONFIGURED'});
    expect(estimateVideo({...input,referenceAssetId:'00000000-0000-4000-8000-000000000001'},now)).toMatchObject({status:'unavailable',reason:'PRICE_NOT_CONFIGURED'});
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({...contract(),entries:[...contract().entries,{mode:'first-frame',duration:5,resolution:'768P',ratio:'adaptive',maxChargeCents:180}]});
    expect(estimateVideo({...input,referenceAssetId:'00000000-0000-4000-8000-000000000001'},now)).toMatchObject({status:'ready',maxChargeCents:180});
    expect(estimateVideo({...input,ratio:'9:16',referenceAssetId:'00000000-0000-4000-8000-000000000001'},now)).toMatchObject({status:'ready',maxChargeCents:180});
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({...contract(),entries:[...contract().entries,{mode:'first-frame',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:180}]});
    expect(estimateVideo({...input,referenceAssetId:'00000000-0000-4000-8000-000000000001'},now)).toMatchObject({status:'unavailable',reason:'PRICE_CONTRACT_INVALID'});
  });
  it('rejects missing, malformed, expired or changed contracts without falling back to an assumed price',()=>{
    delete process.env.VIDEO_PRICE_CONTRACT_JSON;
    expect(estimateVideo(input,now)).toMatchObject({status:'unavailable',reason:'PRICE_CONTRACT_MISSING'});
    process.env.VIDEO_PRICE_CONTRACT_JSON='{not-json';
    expect(estimateVideo(input,now)).toMatchObject({status:'unavailable',reason:'PRICE_CONTRACT_INVALID'});
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({...contract(),validUntil:'2026-09-01T00:00:00.000Z'});
    expect(estimateVideo(input,now)).toMatchObject({status:'unavailable',reason:'PRICE_CONTRACT_EXPIRED'});
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify(contract());
    const first=estimateVideo(input,now);
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify(contract(130));
    expect(samePriceContract(first,estimateVideo(input,now),now)).toBe(false);
    expect(samePriceContract(first,first,new Date('2026-09-26T04:31:00.000Z'))).toBe(false);
  });
  it('reports readiness only for a validated, reviewed and unexpired contract',()=>{
    delete process.env.VIDEO_PRICE_CONTRACT_JSON;
    expect(hasActiveVideoPriceContract(now)).toBe(false);
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify(contract());
    expect(hasActiveVideoPriceContract(now)).toBe(true);
    expect(hasActiveVideoPriceContract(new Date('2026-10-01T00:00:00.000Z'))).toBe(false);
    process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({...contract(),reviewedAt:'2026-09-27T00:00:00.000Z'});
    expect(hasActiveVideoPriceContract(now)).toBe(false);
  });
});
