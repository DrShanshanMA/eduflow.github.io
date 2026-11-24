import {supabase,connection} from './supabase';
import {demoState,demoEmail} from './demo.mjs';
import {mutate} from './workflow.mjs';
import {visibleState} from './access.mjs';
let activeWorkspace='',demo=false,state:any=null,version=0;
export function chooseWorkspace(id:string){demo=false;activeWorkspace=id;}
export function startDemo(){demo=true;activeWorkspace='';state=demoState();version=0;}
export function leaveWorkspace(){demo=false;activeWorkspace='';state=null;}
export async function apiRequest(options:RequestInit={},query:Record<string,string>={}){
 if(!supabase||!connection.ok)throw Error('Account services are not configured.');
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw Error('Please sign in again.');
 const endpoint=new URL(connection.url+'/functions/v1/public-workflow');
 for(const [key,value] of Object.entries(query))endpoint.searchParams.set(key,value);
 const response=await fetch(endpoint,{...options,headers:{...options.headers,apikey:connection.key!,Authorization:'Bearer '+session.access_token},cache:'no-store'});
 if(response.status===401)await supabase.auth.signOut({scope:'local'});
 return response;
}
export async function requestWorkflow(options:RequestInit={},operation?:string){
 if(demo){
  if(operation==='export')return Response.json({format:'project-studio-demo',workspace:state});
  if(options.method==='POST'){try{const body=JSON.parse(String(options.body));if(body.version!==version)return Response.json({error:'Demo changed. Please retry.'},{status:409});state=mutate(structuredClone(state),demoEmail,body.action);version++;}catch(error){return Response.json({error:error instanceof Error?error.message:'Please retry.'},{status:400})}}
  return Response.json({state:visibleState(state,demoEmail),version,email:demoEmail});
 }
 if(!activeWorkspace)throw Error('Choose a workspace first.');
 return apiRequest(options,{workspace:activeWorkspace,...(operation?{operation}:{})});
}
