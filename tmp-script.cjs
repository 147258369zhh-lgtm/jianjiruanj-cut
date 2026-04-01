const fs = require('fs');
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

const keypair = nacl.sign.keyPair();
const pub = util.encodeBase64(keypair.publicKey);
const sec = util.encodeBase64(keypair.secretKey);

// Rewrite keygen.cjs
let k = fs.readFileSync('keygen.cjs','utf8');
k = k.replace(/DEV_PRIVATE_KEY_BASE64 = "[^"]+"/, 'DEV_PRIVATE_KEY_BASE64 = "' + sec + '"');
fs.writeFileSync('keygen.cjs', k);

// Rewrite useAuthStore.ts
let a = fs.readFileSync('src/store/useAuthStore.ts','utf8');
a = a.replace(/SYSTEM_PUBLIC_KEY = "[^"]+"/, 'SYSTEM_PUBLIC_KEY = "' + pub + '"');
fs.writeFileSync('src/store/useAuthStore.ts', a);

// Generate license
const payload = { m: '2DD7-FFFD-454F', e: Date.now() + 30*24*60*60*1000, v: 'PRO', t: Date.now() };
const payloadBytes = util.decodeUTF8(JSON.stringify(payload));
const priv = util.decodeBase64(sec);
const signed = nacl.sign(payloadBytes, priv);
const code = util.encodeBase64(signed);

console.log('== CODE_START ==');
console.log(code);
console.log('== CODE_END ==');
