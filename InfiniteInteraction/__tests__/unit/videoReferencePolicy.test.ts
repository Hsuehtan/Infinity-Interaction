import {describe,expect,it} from 'vitest';
import {validVideoReferenceImage} from '../../shared/video-reference-policy';

describe('MiniMax-H3 first-frame eligibility',()=>{
  it('accepts verified formats at the documented geometry boundaries and app staging cap',()=>{
    expect(validVideoReferenceImage({mime:'image/png',width:256,height:640},8_000_000)).toBe(true);
    expect(validVideoReferenceImage({mime:'image/jpeg',width:5760,height:2304},1000)).toBe(true);
  });
  it('rejects unsupported geometry and files too large to stage before paid submission',()=>{
    for(const [metadata,bytes] of [
      [{mime:'image/png',width:255,height:640},1000],
      [{mime:'image/png',width:5761,height:2304},1000],
      [{mime:'image/png',width:256,height:800},1000],
      [{mime:'image/webp',width:5760,height:2000},1000],
      [{mime:'image/png',width:640,height:360},8_000_001],
      [{mime:'image/gif',width:640,height:360},1000],
    ] as const)expect(validVideoReferenceImage(metadata,bytes)).toBe(false);
  });
});
