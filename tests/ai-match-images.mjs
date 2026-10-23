import assert from 'node:assert/strict';
globalThis.Deno = { env: { get: (key) => key === 'GEMINI_API_KEY' ? 'test-key' : '' } };
const {validateImages, handler} = await import('../supabase/functions/ai-match/index.ts');
assert.deepEqual(validateImages(undefined), []);
const photo = {mimeType:'image/jpeg', data:Buffer.from([255,216,255,224]).toString('base64')};
assert.deepEqual(validateImages([photo]), [photo]);
for (const invalid of [null, {}, [photo,photo], [{...photo,data:'bad'}], [{...photo,mimeType:'image/svg+xml'}], [{...photo,data:'A'.repeat(2_000_004)}], [{...photo,data:Buffer.from('not an image').toString('base64')}]]) {
  assert.throws(()=>validateImages(invalid));
}
let geminiPayload;
globalThis.fetch = async (url, options) => {
 if (url.includes('generativelanguage.googleapis.com')) {
  geminiPayload=JSON.parse(options.body);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({summary:'계약',keywords:['계약'],matches:[{expert_id:'expert-1',reason:'계약 경력'}],notes:[],questions:[]})}]}}]});
 }
 return Response.json(url.includes('expert_cards') ? [{id:'expert-1',name:'전문가',keywords:['계약'],trust_label:'경력 인증'}] : []);
};
const res=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({concern:'계약 사진 확인', images:[photo]})}));
assert.equal(res.status,200);
assert.deepEqual(geminiPayload.contents[0].parts[1].inlineData,photo);
const invalidRes=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({concern:'계약',images:[{...photo,data:'bad'}]})}));
assert.equal(invalidRes.status,400);
console.log('PASS: validation, invalid requests, Gemini image payload');
