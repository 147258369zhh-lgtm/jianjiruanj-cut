import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);

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
    setIsSearching(true);
    setResults([]);
    setActiveGenre(null);
    try {
      const items = await invoke<WebMusicItem[]>('search_web_music', { keyword: query });
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
      // 1. Download to local disk from Apple's server
      const localPath = await invoke<string>('download_web_music', { 
        url: item.url,
        id: item.id, 
        name: item.name, 
        artist: item.artist 
      });

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

      {/* 快捷搜索模组 */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, padding: '0 0 8px', overflowX: 'auto', whiteSpace: 'nowrap', fontSize: 11 }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>💡 探索技巧:</span>
        <span 
          style={{ cursor: 'pointer', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 12, fontWeight: 600, transition: 'all 0.2s' }} 
          onClick={() => appendToQuery('伴奏')}
        >🎶 找伴奏</span>
        <span 
          style={{ cursor: 'pointer', color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '3px 10px', borderRadius: 12, fontWeight: 600, transition: 'all 0.2s' }} 
          onClick={() => appendToQuery('原唱')}
        >🎤 找原唱</span>
        <span 
          style={{ cursor: 'pointer', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: 12, fontWeight: 600, transition: 'all 0.2s' }} 
          onClick={() => appendToQuery('周杰伦')}
        >🎵 指定大牌歌手</span>
      </div>

      {/* 动态筛选标籤 */}
      {genres.length > 0 && !isSearching && (
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, padding: '0 0 8px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <div
            onClick={() => setActiveGenre(null)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
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
                padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
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
    </div>
  );
};
