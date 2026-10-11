import {describe,it,expect} from 'vitest';
import {parseEditorJson} from '../../shared/generic/json-editor';
describe('JSON editor locations',()=>{
 it('preserves scalar types and nested content',()=>expect(parseEditorJson('{"n":[1,true,"x",null]}')).toEqual({n:[1,true,'x',null]}));
 it('locates an absent nested value',()=>expect(()=>parseEditorJson('{"engine":"sample",\n "input": }')).toThrow('第 2 行，第 11 列'));
 it.each(['{"x":1,}','{"x" 1}','[1 2]','"unterminated','{"x":01}','{"x":"\\q"}'])('reports location for %s',text=>expect(()=>parseEditorJson(text)).toThrow(/JSON 第 \d+ 行，第 \d+ 列/));
});
