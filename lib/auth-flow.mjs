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
