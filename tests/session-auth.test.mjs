import {test} from 'node:test';import assert from 'node:assert/strict';
import {verifiedSessionUser} from '../supabase/functions/workflow/session-auth.mjs';
const uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002';
const token=claims=>'verified.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
const getUser=async()=>({data:{user:{id:uid,email:'qa@example.invalid'}},error:null});
test('signed-out sessions fail even while their access token still verifies',async()=>{assert.equal(await verifiedSessionUser(token({sub:uid,session_id:sid}),{getUser,sessionExists:async()=>false}),null);const user=await verifiedSessionUser(token({sub:uid,session_id:sid}),{getUser,sessionExists:async(s,u)=>s===sid&&u===uid});assert.equal(user.id,uid)});
test('unverified, mismatched, missing and malformed session claims never reach session lookup',async()=>{const sessionExists=()=>assert.fail('must reject before lookup');for(const claims of [{sub:'other',session_id:sid},{sub:uid},{sub:uid,session_id:'bad'}])assert.equal(await verifiedSessionUser(token(claims),{getUser,sessionExists}),null);assert.equal(await verifiedSessionUser(token({sub:uid,session_id:sid}),{getUser:async()=>({error:{message:'invalid'}}),sessionExists}),null)});
