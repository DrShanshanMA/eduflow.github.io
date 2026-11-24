// Decode claims only after Supabase Auth has verified the token and returned its user.
export async function verifiedSessionUser(token,{getUser,sessionExists}){
 const {data,error}=await getUser(token);if(error||!data?.user)return null;
 let claims;try{claims=JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/')))}catch{return null}
 const user=data.user,sessionId=claims.session_id;
 if(claims.sub!==user.id||typeof sessionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))return null;
 return await sessionExists(sessionId,user.id)?user:null;
}
