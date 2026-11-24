import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createPublicHandler} from './handler.mjs';
import {verifiedSessionUser} from './session-auth.mjs';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const url=Deno.env.get('SUPABASE_URL')!;
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const server=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
Deno.serve(createPublicHandler({allowedOrigins:['https://drshanshanma.github.io'],
 authenticate:(token:string)=>verifiedSessionUser(token,{getUser:(value:string)=>auth.auth.getUser(value),sessionExists:async(sessionId:string,userId:string)=>{const {data,error}=await server.rpc('coursestudio_session_active',{p_session_id:sessionId,p_user_id:userId});if(error)throw error;return data===true;}}),
 store:{
  list:async(email:string)=>{const {data,error}=await server.from('project_studio_members').select('workspace_id,project_studio_workspaces(id,name,created_at)').eq('email',email);if(error)throw error;return data.map((m:any)=>m.project_studio_workspaces).filter(Boolean);},
  create:async({name,userId,email,payload}:any)=>{const {data,error}=await server.rpc('project_studio_create',{p_name:name,p_creator_id:userId,p_email:email,p_payload:payload});if(error){if(error.message.includes('Workspace limit'))return null;throw error;}return data;},
  load:async(id:string,email:string)=>{const membership=await server.from('project_studio_members').select('workspace_id').eq('workspace_id',id).eq('email',email).maybeSingle();if(membership.error)throw membership.error;if(!membership.data)return null;const {data,error}=await server.from('project_studio_workspaces').select('payload,version').eq('id',id).maybeSingle();if(error)throw error;return data;},
  save:async(id:string,email:string,payload:unknown,version:number)=>{const {data,error}=await server.rpc('project_studio_save',{p_workspace_id:id,p_email:email,p_version:version,p_payload:payload});if(error)throw error;return data===true;}
 }
}));
