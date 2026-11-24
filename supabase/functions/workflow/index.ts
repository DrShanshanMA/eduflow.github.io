import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {verifiedSessionUser} from './session-auth.mjs';
import {createWorkflowHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const server=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
const table=()=>server.from('coursestudio_workspace');
function buildHandler(settings:{owner_email?:string,allowed_origins?:string[]}){return createWorkflowHandler({
 allowedOrigins:settings.allowed_origins||(Deno.env.get('COURSESTUDIO_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),
 ownerEmail:settings.owner_email||Deno.env.get('COURSESTUDIO_OWNER_EMAIL'),
 authenticate:(token:string)=>verifiedSessionUser(token,{getUser:(value:string)=>auth.auth.getUser(value),sessionExists:async(sessionId:string,userId:string)=>{const {data,error}=await server.rpc('coursestudio_session_active',{p_session_id:sessionId,p_user_id:userId});if(error)throw error;return data===true;}}),
 storage:{
  load:async()=>{const {data,error}=await table().select('payload,version').eq('id','team').maybeSingle();if(error)throw error;return data;},
  initialize:async(payload:unknown)=>{const {error}=await table().upsert({id:'team',payload,version:0},{onConflict:'id',ignoreDuplicates:true});if(error)throw error;},
  save:async(payload:unknown,version:number)=>{const {data,error}=await table().update({payload,version:version+1,updated_at:new Date().toISOString()}).eq('id','team').eq('version',version).select('id');if(error)throw error;return data.length===1;}
 }
});}
Deno.serve(async request=>{try{const {data,error}=await server.from('coursestudio_settings').select('owner_email,allowed_origins').eq('id','team').maybeSingle();if(error)throw error;return await buildHandler(data||{})(request);}catch{return Response.json({error:'Workspace settings are unavailable.'},{status:503});}});
