import {randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {completeReferenceSchema,isCompleteReference,legacyReferenceSchema} from '../../shared/references';

const base={schemaVersion:2 as const,id:'person-a',category:'person' as const,name:' 人物 ',description:' 角色描述 ',assetIds:[randomUUID()],details:{}};

describe('S1 media reference contract',()=>{
  it('requires complete data for each new category and normalizes text',()=>{
    for(const category of ['person','scene','prop','voice'] as const){
      const parsed=completeReferenceSchema.parse({...base,category});
      expect(parsed).toMatchObject({category,name:'人物',description:'角色描述'});
      expect(isCompleteReference(parsed)).toBe(true);
    }
    expect(completeReferenceSchema.safeParse({...base,description:'  '}).success).toBe(false);
    expect(completeReferenceSchema.safeParse({...base,assetIds:[]}).success).toBe(false);
    expect(completeReferenceSchema.safeParse({...base,assetIds:[base.assetIds[0],base.assetIds[0]]}).success).toBe(false);
    expect(completeReferenceSchema.safeParse({...base,category:'other'}).success).toBe(false);
  });

  it('reads historical incomplete records without silently upgrading them',()=>{
    const old={id:'legacy-a',category:'other',name:'资料',description:'',assetIds:[]};
    const parsed=legacyReferenceSchema.parse(old);
    expect(parsed).toEqual(old);
    expect(isCompleteReference(parsed)).toBe(false);
    expect(completeReferenceSchema.safeParse({...old,schemaVersion:2}).success).toBe(false);
  });
});

 it('rejects the removed setting relationship commands',async()=>{
  const {envelopeSchema}=await import('../../app/infinite/model');
  for(const type of ['reference.link','reference.unlink'])expect(envelopeSchema.safeParse({commandId:'00000000-0000-4000-8000-000000000001',baseRevision:0,action:'edit',operations:[{type,firstId:'a',secondId:'b'}]}).success).toBe(false);
 });
