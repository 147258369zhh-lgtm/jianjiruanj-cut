const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

/*
 * 【专属发卡工具】
 * 
 * 1. 首次使用前，先运行一次 generateKeys()，把生成的 PublicKey 写到软件源码里！
 * 2. 把生成的 PrivateKey 保存好，这是发卡的唯一凭证。
 */

// 测试用：你可以每次运行重新生成，也可以固定一对（软件发布时必须固定死一对）
const DEV_PRIVATE_KEY_BASE64 = "68cy6ffJRDFzelGOrkq31cslfbYwieB1RuwKRSJNeczSC74cyuLM7x+ubKhYnYw/R3oF7YDbvBpPL36ya5VAsg==";

function generateKeys() {
    console.log('=== 生成全新密钥对 ===');
    const keypair = nacl.sign.keyPair();
    const publicKey = util.encodeBase64(keypair.publicKey);
    const privateKey = util.encodeBase64(keypair.secretKey);
    console.log('PublicKey (写到前端 src/store/useAuthStore.ts 里):', publicKey);
    console.log('PrivateKey (发卡老总私人保存，坚决不能外泄):', privateKey);
    console.log('======================\n');
}

/**
 * 为用户生成授权码
 * @param {string} machineId 用户发来的机器码
 * @param {number} days 授权天数 (如 30, 365. 传 9999 代表永久)
 */
function createLicense(machineId, days) {
    if (!machineId) {
        console.error('错误: 请提供机器码！');
        return;
    }
    
    // 构造授权信息 JSON
    const payload = {
        m: machineId, // 机器码
        e: Date.now() + days * 24 * 60 * 60 * 1000, // expire time 到期时间戳
        v: "PRO", // 版本
        t: Date.now() // 发卡时间，增加随机性
    };

    const payloadStr = JSON.stringify(payload);
    const payloadBytes = util.decodeUTF8(payloadStr);

    // 用老总私钥对该信息进行密码学签名
    const privateKeyBytes = util.decodeBase64(DEV_PRIVATE_KEY_BASE64);
    
    try {
        const signedMsg = nacl.sign(payloadBytes, privateKeyBytes);
        // 生成最终的离线授权码 (Base64格式长串)
        const licenseCode = util.encodeBase64(signedMsg);
        
        console.log(`\n=== 授权生成成功 ===`);
        console.log(`目标机器码 : ${machineId}`);
        console.log(`授权天数   : ${days} 天`);
        console.log(`\n[请完整复制下方这串激活码发给客户]`);
        console.log("=================================================");
        console.log(licenseCode);
        console.log("=================================================\n");
        
    } catch (err) {
        console.error("生成失败，如果是私钥错误请检查:", err);
    }
}

// ========================
// 命令行快捷使用逻辑
// 用法: 
// 1. 生成密钥: node keygen.js init
// 2. 发卡给客户: node keygen.js [机器码] [天数]
// ========================
const args = process.argv.slice(2);
if (args[0] === 'init') {
    generateKeys();
} else if (args.length >= 2) {
    const machineId = args[0];
    const days = parseInt(args[1], 10);
    createLicense(machineId, days);
} else {
    console.log(`
用法提示:
1. 初始化新密钥: node keygen.js init
2. 给客户发卡: node keygen.js <机器码> <天数>
   (例如: node keygen.js D8A9-2B4F-88C1 30)
`);
}
