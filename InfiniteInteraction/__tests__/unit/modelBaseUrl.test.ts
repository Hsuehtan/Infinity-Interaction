import {describe,expect,it} from 'vitest';
import {modelBaseUrlSchema} from '../../shared/model-connections';

describe('model Base URL form validation',()=>{
  it('accepts a provider HTTPS origin with an optional path',()=>{
    expect(modelBaseUrlSchema.safeParse('https://api.tu-zi.com').success).toBe(true);
    expect(modelBaseUrlSchema.safeParse('https://api.example.com/v1').success).toBe(true);
  });
  it.each([
    'http://api.tu-zi.com','https://127.0.0.1','https://127.1','https://[::1]',
    'https://localhost','https://api.internal','https://user:password@api.example.com',
    'https://api.example.com/v1?key=secret','https://api.example.com/#token',
  ])('rejects unsafe Base URL before saving: %s',value=>{
    expect(modelBaseUrlSchema.safeParse(value).success).toBe(false);
  });
});
