import {createClient} from '@supabase/supabase-js';
import deployment from './deployment-config.json';
import {publicConfig} from './public-config.mjs';
export const connection=publicConfig(import.meta.env.VITE_SUPABASE_URL||deployment.url,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||deployment.key);
export const supabase=connection.ok?createClient(connection.url!,connection.key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null;
export function appRedirectUrl(){
 const configured=import.meta.env.VITE_AUTH_REDIRECT_URL;
 if(configured){const url=new URL(configured);if(url.origin!==window.location.origin)throw Error('The sign-in redirect must use this website’s origin.');return url.href;}
 return new URL(import.meta.env.BASE_URL,window.location.href).href;
}
export async function requestWorkflow(options:RequestInit={},operation?:string){
 if(!supabase||!connection.ok)throw Error(connection.message||'Supabase is not configured.');
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw Error('Your session has ended. Please sign in again.');
 const endpoint=new URL(connection.url+'/functions/v1/workflow');if(operation)endpoint.searchParams.set('operation',operation);
 return fetch(endpoint,{...options,headers:{...options.headers,apikey:connection.key!,Authorization:'Bearer '+session.access_token},cache:'no-store'});
}
