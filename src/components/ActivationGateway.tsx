import React from 'react';
import { useAuthStore } from '../store/useAuthStore';

export const ActivationGateway: React.FC = () => {
  const { isInitializing, isLocked, errorMsg, machineId, verifyCode } = useAuthStore();
  const [inputCode, setInputCode] = React.useState('');
  const [localMsg, setLocalMsg] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);

  // 初始化时不要显示白屏死锁，应该让主界面透出加载中或者静默通过
  if (isInitializing) return null;
  // 如果没有锁定，就全部透传放行！
  if (!isLocked) return null;

  const handleActivate = async () => {
    if (!inputCode.trim()) {
      setLocalMsg('请输入管理员发给你的专属离线证书代码！');
      return;
    }
    setIsVerifying(true);
    const success = await verifyCode(inputCode);
    if (!success) {
      setLocalMsg(useAuthStore.getState().errorMsg);
    }
    setIsVerifying(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backdropFilter: 'blur(32px) saturate(150%)',
      backgroundColor: 'rgba(15, 23, 42, 0.8)', // Slate-900 with opacity
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', userSelect: 'none'
    }}>
      <div className="glass-panel" style={{
        width: 520, padding: 32, borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex', flexDirection: 'column', gap: 20
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, background: 'linear-gradient(to right, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            软件试用已到期 / 锁定
          </h2>
          <p style={{ marginTop: 8, fontSize: 13, color: '#94A3B8' }}>
            {errorMsg || '您的30分钟免费体验期已结束，请填入正版激活码以永久解锁所有专业级视频合成与滤镜功能。'}
          </p>
        </div>

        {/* 机器码展示区域 */}
        <div style={{ 
          background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>您的专属机器绑定码 (Device ID)</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 18, color: '#38BDF8', letterSpacing: 2 }}>
              {machineId}
            </span>
            <button 
              className="ios-hover-scale"
              style={{
                background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.2s'
              }}
              onClick={() => {
                navigator.clipboard.writeText(machineId);
                setLocalMsg('✅ 机器码已复制，请发给微信客服获取授权码');
              }}
            >
              复制指纹
            </button>
          </div>
        </div>

        {/* 激活码输入区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#e2e8f0' }}>请输入离线授权证书码 (长代码):</span>
          <textarea 
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            placeholder="在此处粘贴包含您硬件特征和日期的数百位签名证书..."
            style={{
              width: '100%', height: 100, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 12, padding: 12, color: '#F8FAFC', fontFamily: 'monospace', fontSize: 12, resize: 'none',
              outline: 'none', transition: '0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#818CF8'}
            onBlur={e => e.target.style.borderColor = 'rgba(148,163,184,0.3)'}
          />
        </div>

        {localMsg && (
          <div style={{ fontSize: 12, color: localMsg.includes('✅') ? '#34D399' : '#F87171', textAlign: 'center' }}>
            {localMsg}
          </div>
        )}

        {/* 底部按钮 */}
        <button
          className="ios-hover-scale"
          onClick={handleActivate}
          disabled={isVerifying}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', border: 'none', cursor: isVerifying ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)', transition: '0.2s', marginTop: 8
          }}
        >
          {isVerifying ? '正在验证核心签名...' : '校验身份并解锁软体'}
        </button>
      </div>
    </div>
  );
};
