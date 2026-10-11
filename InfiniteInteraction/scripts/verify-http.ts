import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { provisionUser } from '../server/auth';
import { database } from '../server/db';
async function main() {
  const origin = process.env.APP_ORIGIN!;
  const username = `http-test-${randomUUID()}`, password = randomUUID()+randomUUID();
  const user = await provisionUser(username, password);
  try {
    for (const path of ['/api/local-asset?src=/etc/passwd','/api/ai-settings/agents?debug=1','/api/ai-settings/agents/test','/ai-debug','/editor']) {
      const response = await fetch(origin+path); assert.equal(response.status,404,path);
    }
    assert.equal((await fetch(origin+'/api/projects')).status,401);
    assert.equal((await fetch(origin+'/api/auth',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password}) })).status,403);
    const auth = await fetch(origin+'/api/auth',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    assert.equal(auth.status,200); const cookie=auth.headers.get('set-cookie')!; assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Lax/);
    const headers={origin,'Content-Type':'application/json',cookie:cookie.split(';')[0]};
    const response=await fetch(origin+'/api/projects',{method:'POST',headers,body:JSON.stringify({title:'HTTP 验收'})});
    assert.equal(response.status,201); const project=await response.json(); assert.equal(project.graph.nodes.length,0);
    const invalid=await fetch(origin+`/api/projects/${project.id}/commands`,{method:'POST',headers,body:JSON.stringify({commandId:randomUUID(),baseRevision:0,action:'edit',operations:[{type:'project.rename',title:'恶意角色'}],actor:randomUUID()})});
    assert.equal(invalid.status,400);
    const out=await fetch(origin+'/api/auth',{method:'DELETE',headers}); assert.equal(out.status,200);
    assert.equal((await fetch(origin+'/api/projects',{headers})).status,401);
    console.log('PASS: 5 removed local routes; authentication; origin protection; opaque cookie; cloud creation; actor spoofing rejection; logout revocation.');
  } finally {
    await database().query('DELETE FROM projects WHERE owner_id=$1',[user.id]);
    await database().query('DELETE FROM users WHERE id=$1',[user.id]);
    await database().query('DELETE FROM login_limits WHERE username=$1',[user.username]);
    await database().end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
