export function publicConfig(url,key){
 if(!url||!key)return {ok:false,message:'CourseStudio is waiting for its Supabase connection settings.'};
 let parsed;try{parsed=new URL(url)}catch{return {ok:false,message:'The Supabase project URL is invalid.'}}
 if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))return {ok:false,message:'Use a secure Supabase project URL.'};
 let allowed=key.startsWith('sb_publishable_');
 if(!allowed&&key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replaceAll('-','+').replaceAll('_','/')));allowed=payload.role==='anon'}catch{}}
 if(!allowed)return {ok:false,message:'Use only the Supabase publishable key or legacy anon key. Secret and service-role keys must never be published.'};
 return {ok:true,url:parsed.href.replace(/\/$/,''),key};
}
