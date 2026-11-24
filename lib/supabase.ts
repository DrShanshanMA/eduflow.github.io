import {createClient} from '@supabase/supabase-js';
import {consumeAuthCallback,completeAuthCallback,observeRecovery,shareableAppUrl} from './auth-flow.mjs';
import deployment from './deployment-config.json';
import {publicConfig} from './public-config.mjs';
export const connection=publicConfig(import.meta.env.VITE_SUPABASE_URL||deployment.url,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||deployment.key);
const incoming=consumeAuthCallback(window.location.href,(url:string)=>window.history.replaceState(window.history.state,'',url));
export const authCallback={recovery:incoming.recovery,error:incoming.error};
export const supabase=connection.ok?createClient(connection.url!,connection.key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}}):null;
// Subscribe before React mounts so fast email callbacks cannot lose recovery intent.
try{authCallback.recovery ||= sessionStorage.getItem('coursestudio-password-recovery')==='true'}catch{}
if(supabase){observeRecovery(supabase.auth,authCallback);supabase.auth.onAuthStateChange(event=>{try{if(event==='PASSWORD_RECOVERY')sessionStorage.setItem('coursestudio-password-recovery','true');if(event==='SIGNED_OUT')sessionStorage.removeItem('coursestudio-password-recovery')}catch{}});}
export const authReady=supabase?completeAuthCallback(supabase.auth,incoming):undefined;
export function appRedirectUrl(){
 const configured=import.meta.env.VITE_AUTH_REDIRECT_URL;
 if(configured){const url=new URL(configured);if(url.origin!==window.location.origin)throw Error('The sign-in redirect must use this website’s origin.');return url.href;}
 return shareableAppUrl(window.location.href,import.meta.env.BASE_URL);
}
export async function requestWorkflow(options:RequestInit={},operation?:string){
 if(!supabase||!connection.ok)throw Error(connection.message||'Supabase is not configured.');
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw Error('Your session has ended. Please sign in again.');
 const endpoint=new URL(connection.url+'/functions/v1/workflow');if(operation)endpoint.searchParams.set('operation',operation);
 const response=await fetch(endpoint,{...options,headers:{...options.headers,apikey:connection.key!,Authorization:'Bearer '+session.access_token},cache:'no-store'});
 if(response.status===401)await supabase.auth.signOut({scope:'local'});
 return response;
}
