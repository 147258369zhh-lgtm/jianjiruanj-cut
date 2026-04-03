import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'react-qr-code';
import { useAppContext } from '../hooks/useAppContext';
import { getMediaDuration } from '../utils/mediaUtils';

interface WebMusicItem {
  id: number;
  name: string;
  artist: string;
  cover: string;
  duration: number;
  url: string;
  genre: string;
}

export const WebMusicPanel: React.FC = () => {
  const { setResources, setAudioItems, playTimeRef } = useAppContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WebMusicItem[]>([]);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [source, setSource] = useState<'apple' | 'jamendo' | 'netease' | 'bilibili' | 'local' | 'youtube'>('apple');
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);
  const [playingId, setPlayingId] = useState<number | string | null>(null);
  const [globalProxy, setGlobalProxy] = useState(() => localStorage.getItem('U2_PROXY') || '');
  const [showProxySetting, setShowProxySetting] = useState(false);

  // Auth States for Bilibili
  const [biliSessData, setBiliSessData] = useState<string>(() => localStorage.getItem('BILI_SESSDATA') || '');
  const [showBiliAuth, setShowBiliAuth] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrKey, setQrKey] = useState('');
  const [authStatusMsg, setAuthStatusMsg] = useState('请使用哔哩哔哩App扫码登录');
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (showBiliAuth && qrKey) {
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const res = await invoke<[number, string, string]>('bili_poll_qr_auth', { qrcodeKey: qrKey });
          const [code, msg, sessdata] = res;
          
          if (code === 86038) {
            setAuthStatusMsg('二维码已失效，请重新生成');
            clearInterval(pollTimerRef.current as number);
          } else if (code === 86090) {
            setAuthStatusMsg('已扫码，请在手机端确认登录...');
          } else if (code === 86101) {
            // just continue waiting
            if (authStatusMsg !== '请使用哔哩哔哩App扫码授权') setAuthStatusMsg('请使用哔哩哔哩App扫码授权');
          } else if (code === 0 && sessdata) {
            setAuthStatusMsg('登录成功！即将刷新...');
            setBiliSessData(sessdata);
            localStorage.setItem('BILI_SESSDATA', sessdata);
            clearInterval(pollTimerRef.current as number);
            setTimeout(() => {
              setShowBiliAuth(false);
            }, 1000);
          } else if (code !== 0) {
            setAuthStatusMsg(`等待中 [状态码: ${code}] ${msg}`);
          }
        } catch (e: any) {
          console.error(e);
          setAuthStatusMsg(`轮询网络异常: ${e}`);
        }
      }, 3000);

      return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      };
    }
  }, [showBiliAuth, qrKey]);

  const handleBiliAuth = async () => {
    setShowBiliAuth(true);
    setQrUrl('');
    setQrKey('');
    setAuthStatusMsg('正在生成安全登录码...');
    try {
      const [url, key] = await invoke<[string, string]>('bili_get_qr_auth');
      setQrUrl(url);
      setQrKey(key);
      setAuthStatusMsg('请使用哔哩哔哩App扫码授权提取原轨');
    } catch (e: any) {
      setAuthStatusMsg('生成扫码失败: ' + e);
    }
  };

  const genres = React.useMemo(() => {
    const list = Array.from(new Set(results.map(r => r.genre).filter(g => g && g !== 'Unknown' && g !== 'Other')));
    return list.slice(0, 15); // Top 15 genres
  }, [results]);

  const filteredResults = React.useMemo(() => {
    return activeGenre ? results.filter(r => r.genre === activeGenre) : results;
  }, [results, activeGenre]);

  const appendToQuery = (text: string) => {
    setQuery(prev => {
      if (prev.includes(text)) return prev;
      return `${prev} ${text}`.trim();
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    if (source === 'bilibili' && !biliSessData) {
      handleBiliAuth();
      return;
    }

    setIsSearching(true);
    setResults([]);
    setActiveGenre(null);
    try {
      let items: WebMusicItem[] = [];
      if (source === 'youtube') {
        items = await invoke<WebMusicItem[]>('search_ytdlp', { 
          keyword: query, 
          proxy: globalProxy || undefined 
        });
      } else {
        items = await invoke<WebMusicItem[]>('search_web_music', { 
          keyword: query, 
          source, 
          sessdata: biliSessData || undefined 
        });
      }
      setResults(items);
    } catch (err: any) {
      alert(`搜索失败: ${err}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadAndImport = async (item: WebMusicItem) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    try {
      // 1. Download to local disk from server
      let localPath = '';
      if (source === 'youtube') {
        localPath = await invoke<string>('download_ytdlp', { 
          url: item.url,
          id: item.id.toString(), 
          name: item.name, 
          artist: item.artist,
          proxy: globalProxy || undefined
        });
      } else {
        localPath = await invoke<string>('download_web_music', { 
          url: item.url,
          id: item.id as number, 
          name: item.name, 
          artist: item.artist,
          sessdata: biliSessData || undefined
        });
      }

      // 2. Add to global resources
      const newResourceId = `web_${item.id}`;
      setResources((prev: any[]) => {
        if (prev.find(r => r.id === newResourceId)) return prev;
        return [...prev, {
          id: newResourceId,
          type: 'audio',
          path: localPath,
          name: `${item.name} - ${item.artist}`,
          status: 'ready'
        }];
      });

      // 3. Add to audio timeline right away
      const dur = await getMediaDuration(localPath);
      setAudioItems((prev: any[]) => {
        // 如果音频轨为空，从0开始；否则从播放头位置插入
        const startPos = prev.length === 0 ? 0 : playTimeRef.current;
        return [...prev, {
          id: `au_${Date.now()}_${Math.random()}`,
          resourceId: newResourceId,
          timelineStart: startPos,
          startOffset: 0,
          duration: dur,
          volume: 1.0
        }];
      });

    } catch (err: any) {
      alert(`下发打捞失败: ${err}`);
    } finally {
      setDownloadingId(null);
      setPlayingId(null);
    }
  };

  const togglePlay = (item: WebMusicItem) => {
    if (playingId === item.id) {
      setPlayingId(null);
    } else {
      setPlayingId(item.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 10px 10px' }}>
      <div style={{ padding: '8px 0', display: 'flex', gap: 6 }}>
        <input 
          className="ios-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="搜索全网海量音乐..."
          style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.06)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: 8, 
            padding: '6px 10px', 
            color: '#fff',
            fontSize: 12
          }}
        />
        <button 
          onClick={handleSearch} 
          disabled={isSearching}
          className="ios-button-primary"
          style={{ width: 60, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {isSearching ? '...' : '搜索'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 0 10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>数据源:</span>
        <select 
          value={source} 
          onChange={e => setSource(e.target.value as any)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#10B981', fontSize: 11, padding: '4px 6px', outline: 'none', cursor: 'pointer', fontWeight: 600,
            maxWidth: 160, textOverflow: 'ellipsis'
          }}
          title="切换网络音乐检索源"
        >
          <option value="apple" style={{ background: '#1a1a2e', color: '#fff' }}>🍎 苹果库 (30秒试听 / 华语精准)</option>
          <option value="youtube" style={{ background: '#1a1a2e', color: '#fff' }}>📺 U2 全球曲库 (全长原轨提取)</option>
          <option value="bilibili" style={{ background: '#1a1a2e', color: '#fff' }}>📺 B站原音 (免版权 / 极客最爱)</option>
          <option value="local" style={{ background: '#1a1a2e', color: '#fff' }}>📂 硬盘检索 (即时扫描本机全长MP3)</option>
        </select>
        
        {source === 'youtube' && (
           <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                 onClick={() => setShowProxySetting(!showProxySetting)}
                 title="点击设置魔法网络代理端口"
           >🌐 代理网络设置</span>
        )}
        
        {source === 'bilibili' && biliSessData && (
           <span style={{ fontSize: 11, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                 onClick={() => { localStorage.removeItem('BILI_SESSDATA'); setBiliSessData(''); }}
                 title="点击注销安全验证"
           >✅ B站已授权</span>
        )}
        
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>💡 探索:</span>
        <span 
          style={{ cursor: 'pointer', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap' }} 
          onClick={() => appendToQuery('伴奏')}
        >🎶 找伴奏</span>
        <span 
          style={{ cursor: 'pointer', color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap' }} 
          onClick={() => appendToQuery('原唱')}
        >🎤 找原唱</span>
        <span 
          style={{ cursor: 'pointer', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap' }} 
          onClick={() => appendToQuery('Vlog')}
        >🎵 搜 Vlog</span>
      </div>

      {showProxySetting && source === 'youtube' && (
        <div style={{ display: 'flex', gap: 6, padding: '0 0 10px', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>HTTP/SOCKS 代理:</span>
          <input 
            value={globalProxy}
            onChange={e => {
              setGlobalProxy(e.target.value);
              localStorage.setItem('U2_PROXY', e.target.value);
            }}
            placeholder="例如: http://127.0.0.1:10809 (留空则默认系统代理)"
            style={{ 
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 11, width: 220 
            }}
          />
        </div>
      )}

      {/* 动态筛选标籤 */}
      {genres.length > 0 && !isSearching && (
        <div style={{ display: 'flex', gap: 6, padding: '0 0 8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            onClick={() => setActiveGenre(null)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap',
              background: activeGenre === null ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
              color: activeGenre === null ? '#10B981' : 'rgba(255,255,255,0.6)',
              fontWeight: activeGenre === null ? 600 : 'normal'
            }}
          >
            全部
          </div>
          {genres.map(g => (
            <div
              key={g}
              onClick={() => setActiveGenre(g === activeGenre ? null : g)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap',
                background: activeGenre === g ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                color: activeGenre === g ? '#10B981' : 'rgba(255,255,255,0.6)',
                fontWeight: activeGenre === g ? 600 : 'normal'
              }}
            >
              {g}
            </div>
          ))}
        </div>
      )}

      <div className="custom-media-scroll" style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8 }}>
        {isSearching && <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.5, fontSize: 12 }}>网络搜寻中...</div>}
        {!isSearching && results.length === 0 && <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.3, fontSize: 12 }}>输入关键词获取海量无损免筒音乐</div>}
        {!isSearching && results.length > 0 && filteredResults.length === 0 && <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.3, fontSize: 12 }}>该分类下没有相关歌曲</div>}
        
        {!isSearching && filteredResults.map(item => (
          <div key={item.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            padding: '8px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: 8, 
            marginBottom: 6,
            transition: 'background 0.2s'
          }}>
            {/* 试听与封面播放器 */}
            <div 
              style={{ 
                width: 44, height: 44, 
                borderRadius: 8, 
                background: `url(${item.cover || 'rgba(255,255,255,0.05)'}) center/cover`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => togglePlay(item)}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
              <div style={{ position: 'relative', color: '#fff', fontSize: 18 }}>
                {playingId === item.id ? '⏸' : '▶'}
              </div>
              {playingId === item.id && (
                <audio autoPlay onChange={e => (e.target as any).volume = 0.5} src={item.url} onEnded={() => setPlayingId(null)} />
              )}
            </div>

            {/* 信息区 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.artist}
                </div>
                {item.genre && item.genre !== 'Unknown' && item.genre !== 'Other' && (
                  <div style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {item.genre}
                  </div>
                )}
              </div>
            </div>

            {/* 下载入库按钮 */}
            <button 
              onClick={() => handleDownloadAndImport(item)}
              disabled={downloadingId === item.id}
              className="ios-button-primary"
              style={{
                background: downloadingId === item.id ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.15)',
                color: downloadingId === item.id ? '#888' : '#10B981',
                border: 'none',
                borderRadius: 20,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: downloadingId === item.id ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {downloadingId === item.id ? '下载中' : '⬇ 提取'}
            </button>
          </div>
        ))}
      </div>
      
      {showBiliAuth && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20
        }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: 16, boxShadow: '0 8px 32px rgba(16,185,129,0.3)', marginBottom: 20 }}>
            {qrUrl ? (
              <QRCode value={qrUrl} size={180} fgColor="#FB7299" />
            ) : (
              <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>生成中...</div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#FB7299' }}>📺 B站大会员专属提权</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', maxWidth: 240, marginBottom: 20 }}>
            {authStatusMsg}
          </div>
          <button 
            className="ios-button"
            onClick={() => setShowBiliAuth(false)}
            style={{ padding: '6px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
          >
            取消验证
          </button>
        </div>
      )}
    </div>
  );
};
