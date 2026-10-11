import type { CloudProject, Operation } from './model';
export class ApiError extends Error { constructor(message: string, public code: string, public status: number) { super(message); } }
function reject(response:Response,body:any):never{
  if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('interaction:auth-required',{detail:{code:body?.code||'UNAUTHENTICATED'}}));
  throw new ApiError(body?.error||'请求失败，请重试。',body?.code||'REQUEST_FAILED',response.status);
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, cache: 'no-store' });
  } catch {
    throw new ApiError('无法连接服务，请检查网络后重试。', 'NETWORK_ERROR', 0);
  }
  const body = await response.json();
  if (!response.ok) reject(response,body);
  return body;
}
export async function apiForm<T>(url:string,form:FormData):Promise<T>{
  let response:Response;
  try{response=await fetch(url,{method:'POST',body:form,cache:'no-store'});}catch{throw new ApiError('无法连接服务，请检查网络后重试。','NETWORK_ERROR',0);}
  const body=await response.json();
  if(!response.ok)reject(response,body);
  return body;
}
export async function command(project: CloudProject, operations: Operation[], action: 'edit' | 'undo' | 'redo' = 'edit', commandId = crypto.randomUUID()) {
  return api<CloudProject>(`/api/projects/${project.id}/commands`, { method: 'POST', body: JSON.stringify({ commandId, baseRevision: project.revision, operations, action }) });
}
