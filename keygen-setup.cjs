const fs = require('fs');
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

const keypair = nacl.sign.keyPair();
const pub = util.encodeBase64(keypair.publicKey);
const sec = util.encodeBase64(keypair.secretKey);

// Update keygen.cjs
let k = fs.readFileSync('keygen.cjs', 'utf8');
k = k.replace(/const DEV_PRIVATE_KEY_BASE64 = "[^"]+";/, 'const DEV_PRIVATE_KEY_BASE64 = "' + sec + '";');
fs.writeFileSync('keygen.cjs', k);

// Update useAuthStore.ts
let a = fs.readFileSync('src/store/useAuthStore.ts', 'utf8');
a = a.replace(/const SYSTEM_PUBLIC_KEY = "[^"]+";/, 'const SYSTEM_PUBLIC_KEY = "' + pub + '";');
fs.writeFileSync('src/store/useAuthStore.ts', a);

console.log('--- REGENERATED KEYS ---');
console.log('PUB: ' + pub);
console.log('SEC: ' + sec);
console.log('------------------------');

const mId = '2DD7-FFFD-454F';
const days = 30;
const payload = { m: mId, e: Date.now() + days * 24 * 60 * 60 * 1000, v: 'PRO', t: Date.now() };

const payloadBytes = util.decodeUTF8(JSON.stringify(payload));
const privBytes = util.decodeBase64(sec);
const signedMsg = nacl.sign(payloadBytes, privBytes);
const code = util.encodeBase64(signedMsg);

fs.writeFileSync('my_license.txt', code, 'utf8');
console.log('Successfully generated license for ' + mId + ' to my_license.txt');
