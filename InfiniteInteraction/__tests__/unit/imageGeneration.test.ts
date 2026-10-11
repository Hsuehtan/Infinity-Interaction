import {randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {imageInputSchema,imageQuote} from '../../shared/image-generation';

const base={schemaVersion:1,mode:'text',prompt:' 一只白兔在花园中 ',resolution:'1K',referenceAssetIds:[]};

describe('S1 image request and account quote',()=>{
  it('keeps text and reference inputs mutually exclusive',()=>{
    const assetId=randomUUID();
    expect(imageInputSchema.parse(base).prompt).toBe('一只白兔在花园中');
    expect(imageInputSchema.safeParse({...base,referenceAssetIds:[assetId]}).success).toBe(false);
    expect(imageInputSchema.safeParse({...base,mode:'reference'}).success).toBe(false);
    expect(imageInputSchema.safeParse({...base,mode:'reference',referenceAssetIds:[assetId,assetId]}).success).toBe(false);
    expect(imageInputSchema.safeParse({...base,mode:'reference',referenceAssetIds:[assetId]}).success).toBe(true);
    expect(imageInputSchema.safeParse({...base,mode:'reference',referenceAssetIds:[assetId,randomUUID()]}).success).toBe(false);
    expect(imageInputSchema.safeParse({...base,resolution:'768P'}).success).toBe(false);
  });

  it('uses the user tariff without losing the fractional cent of 1K',()=>{
    for(const [resolution,exactMilliYuan,maxChargeCents] of [['1K',28,3],['2K',120,12],['4K',210,21]] as const){
      const input=imageInputSchema.parse({...base,resolution});
      expect(imageQuote(input)).toMatchObject({exactMilliYuan,maxChargeCents,images:1});
    }
  });
});

 it('drops obsolete setting handoff metadata while keeping the ordinary workshop draft',async()=>{
  const {videoComposerDraftSchema,defaultVideoComposerDraft}=await import('../../shared/video-generation');
  const source={...defaultVideoComposerDraft,outputKind:'image',image:{...defaultVideoComposerDraft.image,purpose:{kind:'reference-create',name:'old draft'}}};
  const draft=videoComposerDraftSchema.parse(source);
  expect(draft.outputKind).toBe('image');expect(draft.image).not.toHaveProperty('purpose');
 });
