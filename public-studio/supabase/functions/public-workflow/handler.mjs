import {initial} from '../_shared/domain/workflow.mjs';
import {createWorkflowHandler} from './workflow-handler.mjs';
export function createPublicHandler({authenticate,store,allowedOrigins}){
 const origins=new Set(allowedOrigins);
 return async request=>{
  const origin=request.headers.get('origin'),headers={'Cache-Control':'no-store','Vary':'Origin'};
  if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  const reply=(data,status=200)=>Response.json(data,{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'Website not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed.'},405);
  try{
   const bearer=request.headers.get('authorization')||'';
   if(!/^Bearer \S+$/i.test(bearer))return reply({error:'Please sign in.'},401);
   const user=await authenticate(bearer.slice(7));
   if(!user?.id||!user.email||!user.email_confirmed_at||user.is_anonymous)return reply({error:'Sign in with a verified email address.'},401);
   const email=user.email.trim().toLowerCase(),url=new URL(request.url),op=url.searchParams.get('op');
   if(op==='workspaces'){
    if(request.method==='GET')return reply({workspaces:await store.list(email)});
    if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'Use a JSON request.'},415);
    const raw=await request.text();if(raw.length>2000)return reply({error:'Request too large.'},413);
    let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid request.'},400)}
    const name=String(body.name||'').trim();if(!name||name.length>80)return reply({error:'Enter a workspace name of 1–80 characters.'},400);
    const id=await store.create({name,userId:user.id,email,payload:initial(email)});
    if(!id)return reply({error:'You can create up to five workspaces.'},400);
    return reply({workspace:{id,name}},201);
   }
   if(op)return reply({error:'Unknown operation.'},400);
   const id=url.searchParams.get('workspace');
   if(!id||!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Choose a workspace.'},400);
   // Never read a workspace payload before membership has been established.
   const row=await store.load(id,email);if(!row)return reply({error:'Workspace not found or access denied.'},403);
   const handler=createWorkflowHandler({authenticate:async()=>user,ownerEmail:'',allowedOrigins,
    storage:{load:async()=>row,initialize:async()=>{throw Error('No implicit workspace creation')},save:async(payload,version)=>{
     if(JSON.stringify(payload).length>4*1024*1024)throw Error('Workspace capacity reached');
     return store.save(id,email,payload,version);
    }}});
   return await handler(request);
  }catch{return reply({error:'Project Studio could not process this request. Please retry.'},503)}
 };
}
