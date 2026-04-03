import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

// 填入使用 keygen.cjs init 生成的【公钥】
const SYSTEM_PUBLIC_KEY = "0gu+HMrizO8frmyoWJ2MP0d6Be2A27waTy9+smuVQLI=";

// 30分钟无缝试用倒计时 (毫秒)
const TRIAL_DURATION_MS = 30 * 60 * 1000;

interface AuthStatePayload {
    first_launch_time: number;
    last_launch_time: number;
    activation_code: string;
}

interface AuthStore {
    isInitializing: boolean;
    machineId: string;
    isLocked: boolean; // 是否锁死（过期或被抓包篡改）
    trialTimeLeft: number; // 剩余倒计时毫秒
    expireDate: number | null; // 授权到期时间
    isVip: boolean; // 是否拥有有效授权码
    errorMsg: string; // 错误信息，如"检测到时间篡改"
    showGateway: boolean; // 主动打开看证书的弹窗
    activationCode: string; // 存在的证书代码
    
    initAuth: () => Promise<void>;
    verifyCode: (code: string) => Promise<boolean>;
    clockTick: () => void;
    setShowGateway: (show: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    isInitializing: true,
    machineId: 'UNKNOWN',
    isLocked: false,
    trialTimeLeft: 0,
    expireDate: null,
    isVip: false,
    errorMsg: '',
    showGateway: false,
    activationCode: '',

    setShowGateway: (show: boolean) => set({ showGateway: show }),

    initAuth: async () => {
        try {
            // 获得唯一底层硬件指纹
            const mId = await invoke<string>('get_machine_id');
            // 只取前 12 位加上横杠，例如 "D8A9-2B4F-88C1" 以增加美观度
            const cleanId = mId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const formatId = `${cleanId.substring(0, 4)}-${cleanId.substring(4, 8)}-${cleanId.substring(8, 12)}`;
            set({ machineId: formatId });

            // 获取持久化文件缓存
            const storeStr = await invoke<string>('read_auth_store');
            let state: AuthStatePayload = { first_launch_time: 0, last_launch_time: 0, activation_code: '' };
            if (storeStr && storeStr !== '{}') {
                try { state = JSON.parse(storeStr); } catch (e) {}
            }

            const now = Date.now();
            let isVipValid = false;
            let expireTs = null;

            // 1. 如果有激活码，优先验证密匙
            if (state.activation_code) {
                try {
                    const decodedMsg = util.decodeBase64(state.activation_code);
                    const pubKeyBytes = util.decodeBase64(SYSTEM_PUBLIC_KEY);
                    const opened = nacl.sign.open(decodedMsg, pubKeyBytes);
                    
                    if (opened) {
                        const payloadStr = util.encodeUTF8(opened);
                        const payload = JSON.parse(payloadStr);

                        // 效验证书绑定的机器码与本机是否相符
                        if (payload.m === formatId && now < payload.e) {
                            isVipValid = true;
                            expireTs = payload.e;
                        } else if (now >= payload.e) {
                            set({ errorMsg: '此设备的授权已到期' });
                        } else {
                            set({ errorMsg: '授权设备特征符不匹配，拒绝跨设备使用' });
                        }
                    }
                } catch(err) {
                   console.log("无效的老激活码");
                }
            }

            // 如果解锁成功，就不需要查时间机制了
            if (isVipValid) {
                set({ isInitializing: false, isLocked: false, isVip: true, expireDate: expireTs, activationCode: state.activation_code });
                
                // 更新一下最后打开时间，防刷
                state.last_launch_time = now;
                await invoke('write_auth_store', { data: JSON.stringify(state) });
                return;
            }

            // ---------- 进入 30分钟 试用逻辑 ----------

            // 如果是首次打开软件 (文件中没有记录 first_launch 时间)
            if (!state.first_launch_time) {
                state.first_launch_time = now;
            }

            // 防时间篡改: 检查电脑手表是不是被往回拔了！
            if (now < state.last_launch_time) {
                // 严重违规！有人篡改系统时间回退来白嫖
                set({ isInitializing: false, isLocked: true, isVip: false, errorMsg: '⚠️ 检测到系统时钟回退异常，试用彻底锁定！' });
                return;
            }

            const elapsed = now - state.first_launch_time;
            const remaining = Math.max(0, TRIAL_DURATION_MS - elapsed);

            // 更新最后时间记录进磁盘
            state.last_launch_time = now;
            await invoke('write_auth_store', { data: JSON.stringify(state) });

            if (remaining > 0) {
                // 试用期内
                set({ isInitializing: false, isLocked: false, isVip: false, trialTimeLeft: remaining });
            } else {
                // 试用彻底抛锚
                set({ isInitializing: false, isLocked: true, isVip: false, trialTimeLeft: 0, errorMsg: '30分钟免费体验期已结束，请购买永久授权许可。' });
            }

        } catch (error) {
            console.error(error);
            set({ isInitializing: false, isLocked: true, errorMsg: '无法提取硬件锁信息，授权受阻' });
        }
    },

    // 每一秒触发一次，重新判定倒计时 (在某个全局位置挂载)
    clockTick: () => {
        const { isVip, isLocked, trialTimeLeft, errorMsg } = get();
        if (isVip || isLocked || !!errorMsg) return; 

        if (trialTimeLeft <= 1000) {
            set({ trialTimeLeft: 0, isLocked: true, errorMsg: '30分钟免费体验期已结束，请填入激活码解锁继续使用。' });
        } else {
            set({ trialTimeLeft: trialTimeLeft - 1000 });
        }
    },

    verifyCode: async (code: string) => {
        const { machineId } = get();
        try {
            const decodedMsg = util.decodeBase64(code.trim());
            const pubKeyBytes = util.decodeBase64(SYSTEM_PUBLIC_KEY);
            const opened = nacl.sign.open(decodedMsg, pubKeyBytes);
            
            if (opened) {
                const payloadStr = util.encodeUTF8(opened);
                const payload = JSON.parse(payloadStr);

                // 核心拦截校验
                if (payload.m !== machineId) {
                    set({ errorMsg: '该激活码绑定的设备指纹与本机不符' });
                    return false;
                }
                
                if (Date.now() >= payload.e) {
                    set({ errorMsg: '输入的激活码已经过期' });
                    return false;
                }

                // 完全通关！
                set({ isLocked: false, isVip: true, errorMsg: '', expireDate: payload.e, showGateway: false, activationCode: code.trim() });

                // 持久化授权码到磁盘深处
                const storeStr = await invoke<string>('read_auth_store');
                let state: AuthStatePayload = { first_launch_time: Date.now(), last_launch_time: Date.now(), activation_code: '' };
                if (storeStr && storeStr !== '{}') {
                    try { state = JSON.parse(storeStr); } catch (e) {}
                }
                state.activation_code = code.trim();
                await invoke('write_auth_store', { data: JSON.stringify(state) });
                
                return true;
            } else {
                set({ errorMsg: '校验失败：激活码被篡改或伪造！' });
                return false;
            }
        } catch (e) {
            console.error(e);
            set({ errorMsg: '解析异常：无效的证书格式，请确保完全复制且无空格' });
            return false;
        }
    }
}));
