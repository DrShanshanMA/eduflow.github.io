import {initial,mutate,normalize} from '../_shared/domain/workflow.mjs';
import {visibleState,isAdmin} from '../_shared/domain/access.mjs';

export function createWorkflowHandler({authenticate,storage,allowedOrigins,ownerEmail}){
 const origins=new Set(allowedOrigins||[]),bootstrap=String(ownerEmail||'').trim().toLowerCase();
 return async function handler(request){
  const origin=request.headers.get('origin');
  const cors={'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(origin&&origins.has(origin))Object.assign(cors,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'600'});
  const respond=(value,status=200)=>Response.json(value,{status,headers:cors});
  if(!origins.size)return respond({error:'The application origin has not been configured.'},503);
  if(origin&&!origins.has(origin))return respond({error:'This website is not allowed to call CourseStudio.'},403);
  if(request.method==='OPTIONS')return origin?new Response(null,{status:204,headers:cors}):respond({error:'Origin required.'},403);
  if(!['GET','POST'].includes(request.method))return respond({error:'Method not allowed.'},405);
  try{
   const authorization=request.headers.get('authorization')||'';
   if(!/^Bearer \S+$/i.test(authorization))return respond({error:'Please sign in to CourseStudio.'},401);
   // Identity comes only from the Auth server's verified user response.
   const user=await authenticate(authorization.slice(7));
   if(!user?.id||!user?.email||!user.email_confirmed_at||user.is_anonymous)return respond({error:'Sign in with a verified email address.'},401);
   const email=user.email.trim().toLowerCase();
   let row=await storage.load();
   if(!row){
    if(!bootstrap)return respond({error:'An administrator must finish the initial workspace setup.'},503);
    if(email!==bootstrap)return respond({error:'The workspace administrator must initialize CourseStudio first.'},403);
    await storage.initialize(initial(email));row=await storage.load();
    if(!row)throw Error('Workspace initialization failed.');
   }
   const state=normalize(structuredClone(row.payload));
   if(!state.members.some(m=>m.email===email&&m.active!==false))return respond({error:state.members.some(m=>m.email===email&&m.active===false)?'Your workspace access has been removed. Ask an administrator to restore it.':'Ask a group manager to add this verified sign-in email to CourseStudio.'},403);
   const operation=new URL(request.url).searchParams.get('operation');
   if(request.method==='GET'&&operation==='export'){
    if(!isAdmin(state,email))return respond({error:'Workspace administrator access required.'},403);
    return respond({format:'coursestudio-backup',schemaVersion:1,exportedAt:new Date().toISOString(),workspace:state});
   }
   if(operation)return respond({error:'Unknown operation.'},400);
   if(request.method==='GET')return respond({state:visibleState(state,email),version:row.version,email});
   if(!(request.headers.get('content-type')||'').includes('application/json'))return respond({error:'Use a JSON request.'},415);
   const declared=Number(request.headers.get('content-length')||0);if(declared>8*1024*1024)return respond({error:'This update is too large.'},413);
   const raw=await request.text();if(raw.length>8*1024*1024)return respond({error:'This update is too large.'},413);
   let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid JSON request.'},400)}
   if(!body||!Number.isSafeInteger(body.version)||body.version<0||!body.action||typeof body.action.type!=='string')return respond({error:'Invalid workflow update.'},400);
   if(body.version!==row.version)return respond({error:'Someone updated this workspace. Refresh and try again.'},409);
   let updated;try{updated=mutate(state,email,body.action)}catch(error){return respond({error:error instanceof Error?error.message:'This update is not permitted.'},400)}
   const saved=await storage.save(updated,row.version);
   if(!saved)return respond({error:'Another update arrived. Refresh and try again.'},409);
   if(!updated.members.some(m=>m.email===email&&m.active!==false))return respond({removedSelf:true,email});
   return respond({state:visibleState(updated,email),version:row.version+1,email});
  }catch{
   // Database and authentication infrastructure details must not enter client responses.
   return respond({error:'CourseStudio could not process the request. Please retry.'},503);
  }
 };
}
