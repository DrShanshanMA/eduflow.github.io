import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createWorkflowHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const server=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
const table=()=>server.from('coursestudio_workspace');
Deno.serve(createWorkflowHandler({
 allowedOrigins:(Deno.env.get('COURSESTUDIO_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),
 ownerEmail:Deno.env.get('COURSESTUDIO_OWNER_EMAIL'),
 authenticate:async(token:string)=>{const {data,error}=await auth.auth.getUser(token);return error?null:data.user;},
 storage:{
  load:async()=>{const {data,error}=await table().select('payload,version').eq('id','team').maybeSingle();if(error)throw error;return data;},
  initialize:async(payload:unknown)=>{const {error}=await table().upsert({id:'team',payload,version:0},{onConflict:'id',ignoreDuplicates:true});if(error)throw error;},
  save:async(payload:unknown,version:number)=>{const {data,error}=await table().update({payload,version:version+1,updated_at:new Date().toISOString()}).eq('id','team').eq('version',version).select('id');if(error)throw error;return data.length===1;}
 }
}));
