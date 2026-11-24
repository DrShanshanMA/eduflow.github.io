// Read callback intent before the Auth client removes callback parameters.
export function callbackState(href){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 const value=name=>hash.get(name)||url.searchParams.get(name);
 const type=value('type');
 const error=value('error_description')||value('error');
 return {flowType:hash.has('access_token')?'implicit':'pkce',recovery:type==='recovery'||type==='invite',error:error?(/expired|invalid|otp_expired/i.test(error+' '+value('error_code'))?'This email link has expired or has already been used. Request a new password reset email and open its newest link.':error):null};
}
export function authErrorMessage(error){
 const text=error?.message||String(error||'');
 if(/code verifier|pkce|flow state|code exchange/i.test(text))return 'This email link could not be completed in this browser. Request a new reset email here, then open its newest link in this same browser.';
 return text;
}
export function observeRecovery(auth,state){
 return auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')state.recovery=true;else if(event==='SIGNED_OUT')state.recovery=false;});
}
// Keep email credentials only in memory, and remove them before any Auth/network work.
export function consumeAuthCallback(href,replace){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 const value=name=>hash.get(name)||url.searchParams.get(name);
 const captured={...callbackState(href),code:value('code'),flowId:value('sb_flow_id'),accessToken:value('access_token'),refreshToken:value('refresh_token')};
 if(['code','access_token','refresh_token','error','error_description','token_hash','token','provider_token','provider_refresh_token'].some(name=>url.searchParams.has(name)||hash.has(name)))replace(url.origin+url.pathname);
 return captured;
}
export async function completeAuthCallback(auth,callback){
 try{
  const initial=await auth.initialize();
  if(callback.error)return {error:{message:callback.error}};
  if(callback.code)return await auth.exchangeCodeForSession(callback.code,callback.flowId?{flowId:callback.flowId}:undefined);
  if(callback.accessToken&&callback.refreshToken)return await auth.setSession({access_token:callback.accessToken,refresh_token:callback.refreshToken});
  return initial;
 }finally{callback.code=null;callback.accessToken=null;callback.refreshToken=null;callback.flowId=null;}
}
export function shareableAppUrl(href,base='./'){const url=new URL(base,href);return url.origin+url.pathname;}
