/** Native parsing for values, with stable line/column diagnostics for editor input. */
export function parseEditorJson(text:string):unknown{
 try{return JSON.parse(text);}catch{
  let at=0;const fail=(message:string):never=>{const before=text.slice(0,at),line=before.split('\n').length,column=at-before.lastIndexOf('\n');throw new Error(`JSON 第 ${line} 行，第 ${column} 列：${message}`);};
  const space=()=>{while(/[\t\n\r ]/.test(text[at]??'!'))at++;};
  const string=()=>{at++;while(at<text.length){const c=text[at++];if(c==='"')return;if(c<' ')fail('字符串内的换行或控制字符需要转义');if(c==='\\'){const escape=text[at++];if(escape==='u'){for(let n=0;n<4;n++)if(!/[0-9a-f]/i.test(text[at++]??'!'))fail('Unicode 转义需要四位十六进制数字');}else if(!'"\\/bfnrt'.includes(escape??'!'))fail('无效的转义字符');}}fail('字符串缺少结束双引号');};
  const value=(depth=0):void=>{if(depth>128)fail('嵌套层数过多');space();const c=text[at];
   if(c==='"'){string();return;}
   if(c==='{'||c==='['){const object=c==='{',end=object?'}':']';at++;space();if(text[at]===end){at++;return;}while(at<text.length){if(object){space();if(text[at]!=='"')fail('字段名需要双引号');string();space();if(text[at++]!==':'){at--;fail('字段名后需要冒号');}}value(depth+1);space();if(text[at]===end){at++;return;}if(text[at++]!==','){at--;fail(`需要逗号或 ${end}`);}space();}fail(`缺少 ${end}`);}
   const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(token){at+=token[0].length;return;}fail('需要有效的 JSON 值');
  };
  value();space();if(at<text.length)fail('值后存在多余字符');fail('JSON 格式不正确');
 }
}
