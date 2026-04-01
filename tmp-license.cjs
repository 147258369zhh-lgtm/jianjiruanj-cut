const fs = require('fs');
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

const sec = "QZaS3Jjbh/T+XExx81pOiMSkUr9A4g2RpKxo9AS0VaAfzkMftqcE7w+kr9ilFiFvwPnYkQKsHEv99RNvYBADbiw==";
const payload = { m: '2DD7-FFFD-454F', e: Date.now() + 30*24*60*60*1000, v: 'PRO', t: Date.now() };

console.log("Generating signature...");
const payloadBytes = util.decodeUTF8(JSON.stringify(payload));
const priv = util.decodeBase64(sec);
const signedMsg = nacl.sign(payloadBytes, priv);
const code = util.encodeBase64(signedMsg);

console.log("Writing to my_license.txt...");
fs.writeFileSync('my_license.txt', code, 'utf8');
console.log("Done.");
