'use client';

import {
  Bot, ChevronDown, CirclePlay, Clock3, Film, GitBranch, Library, Menu,
  MessageSquareText, MoreHorizontal, Play, Plus, Redo2, Settings2, Sparkles,
  Undo2, Users, WandSparkles, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type SceneStatus = 'ready' | 'draft' | 'generating';
type Scene = {
  id: string; chapter: string; title: string; subtitle: string; script: string;
  duration: string; status: SceneStatus; x: number; y: number;
  kind?: 'start' | 'ending'; tone: string;
};

const initialScenes: Scene[] = [
  { id: 's1', chapter: '序章', title: '雨夜来信', subtitle: '林夏收到一封没有署名的信', script: '深夜十一点，林夏在空无一人的旧车站等末班车。广播突然响起她童年时的名字，一封被雨淋湿的信滑到脚边。', duration: '00:18', status: 'ready', x: 46, y: 194, kind: 'start', tone: '悬疑 · 克制' },
  { id: 's2', chapter: '第一幕', title: '打开信封', subtitle: '信里是一张十年前的合影', script: '她拆开信封。照片里站着五个人，其中四个人的脸被划掉，只剩下她自己。背面写着：不要上那班车。', duration: '00:24', status: 'ready', x: 336, y: 88, tone: '紧张 · 冷色' },
  { id: 's3', chapter: '第一幕', title: '追上列车', subtitle: '林夏决定无视警告', script: '列车进站，车门打开，空车厢里只有一盏灯亮着。林夏攥紧照片，踏上车厢。门在她身后缓缓合拢。', duration: '00:21', status: 'draft', x: 336, y: 300, tone: '果断 · 冷峻' },
  { id: 's4', chapter: '第二幕', title: '失物招领处', subtitle: '值班员似乎认识照片上的人', script: '值班员没有看她，只把一本发黄的登记册推过来。林夏发现自己的名字在十年前那一页出现过。', duration: '00:32', status: 'draft', x: 642, y: 88, tone: '诡异 · 静默' },
  { id: 's5', chapter: '第二幕', title: '空车厢', subtitle: '广播开始倒数', script: '每经过一站，照片上就多出一张脸。广播说出下一个名字前，她必须决定是否拉下紧急制动。', duration: '00:28', status: 'draft', x: 642, y: 300, tone: '压迫 · 高对比' },
  { id: 's6', chapter: '结局 A', title: '留下的人', subtitle: '真相并没有让她自由', script: '天亮时，车站恢复喧闹。林夏站在失物招领处，替下一位迷路的人保管那封信。', duration: '00:26', status: 'draft', x: 942, y: 88, kind: 'ending', tone: '释然 · 余韵' },
  { id: 's7', chapter: '结局 B', title: '终点站', subtitle: '列车驶入不存在的站台', script: '倒数归零。窗外的城市忽然熄灭，列车驶进一片白光。座位上只剩下一张新的合影。', duration: '00:22', status: 'draft', x: 942, y: 300, kind: 'ending', tone: '未知 · 留白' },
];

const links = [['s1', 's2'], ['s1', 's3'], ['s2', 's4'], ['s3', 's5'], ['s4', 's6'], ['s5', 's7']];

function StatusDot({ status }: { status: SceneStatus }) {
  return <span className={`status-dot ${status}`} title={status === 'ready' ? '视频已就绪' : status === 'generating' ? '生成中' : '等待生成'} />;
}

export default function Home() {
  const [scenes, setScenes] = useState(initialScenes);
  const [selectedId, setSelectedId] = useState('s2');
  const [view, setView] = useState<'blueprint' | 'timeline'>('blueprint');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState<'video' | 'choice' | 'result'>('video');
  const [saved, setSaved] = useState(true);
  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const totalDuration = useMemo(() => scenes.reduce((sum, scene) => sum + Number(scene.duration.split(':')[1]), 0), [scenes]);

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(context.registerTool({
      name: 'edit_story_scene',
      title: '编辑剧情场景',
      description: '选择一个现有剧情场景，并用创作者提供的脚本替换该场景脚本。不会改写故事或生成新剧情。',
      inputSchema: {
        type: 'object',
        properties: {
          sceneId: { type: 'string', enum: initialScenes.map((scene) => scene.id) },
          script: { type: 'string', minLength: 1 },
        },
        required: ['sceneId', 'script'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== 'object') throw new Error('输入必须包含 sceneId 和 script');
        const { sceneId, script } = input as { sceneId?: unknown; script?: unknown };
        if (typeof sceneId !== 'string' || !initialScenes.some((scene) => scene.id === sceneId)) throw new Error('找不到该场景');
        if (typeof script !== 'string' || !script.trim()) throw new Error('脚本不能为空');
        setSelectedId(sceneId);
        setScenes((current) => current.map((scene) => scene.id === sceneId ? { ...scene, script: script.trim() } : scene));
        setSaved(false);
        return { sceneId, updated: true, characterCount: script.trim().length };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  function updateScript(value: string) {
    setSaved(false);
    setScenes((current) => current.map((scene) => scene.id === selectedId ? { ...scene, script: value } : scene));
  }

  function generateScene() {
    const generatingId = selectedId;
    setScenes((current) => current.map((scene) => scene.id === generatingId ? { ...scene, status: 'generating' as const } : scene));
    window.setTimeout(() => setScenes((current) => current.map((scene) => scene.id === generatingId ? { ...scene, status: 'ready' as const } : scene)), 1800);
  }

  function openPreview() {
    setPreviewStep('video'); setPreviewOpen(true);
    window.setTimeout(() => setPreviewStep('choice'), 900);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="Framebranch 首页"><span className="brand-icon"><Film size={17} /></span><span>FRAMEBRANCH</span></div>
        <div className="project-title"><button className="icon-button" aria-label="项目菜单"><Menu size={17} /></button><div><strong>末班车没有终点</strong><span>{saved ? '所有更改已保存' : '有未保存的更改'}</span></div><ChevronDown size={14} /></div>
        <div className="top-actions"><button className="icon-button" aria-label="撤销"><Undo2 size={16} /></button><button className="icon-button" aria-label="重做"><Redo2 size={16} /></button><button className="secondary-button" onClick={() => setSaved(true)}>保存</button><button className="preview-button" onClick={openPreview}><Play size={15} fill="currentColor" />试玩</button><button className="avatar-button" aria-label="账户">林</button></div>
      </header>

      <aside className="rail" aria-label="主导航">
        <button className="rail-item active"><GitBranch size={19} /><span>故事</span></button>
        <button className="rail-item"><Users size={19} /><span>角色</span></button>
        <button className="rail-item"><Library size={19} /><span>素材</span></button>
        <button className="rail-item"><Bot size={19} /><span>生成</span></button>
        <button className="rail-item rail-bottom"><Settings2 size={19} /><span>设置</span></button>
      </aside>

      <section className="workspace">
        <div className="workspace-toolbar">
          <div className="view-tabs" role="tablist" aria-label="编辑视图">
            <button className={view === 'blueprint' ? 'active' : ''} onClick={() => setView('blueprint')}><GitBranch size={15} />故事蓝图</button>
            <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}><Clock3 size={15} />时间线</button>
          </div>
          <div className="project-stats"><span><i className="stat-dot" />7 个场景</span><span>2 个结局</span><span>约 {Math.floor(totalDuration / 60)}:{String(totalDuration % 60).padStart(2, '0')}</span></div>
          <div className="canvas-tools"><button className="icon-button" aria-label="缩小"><ZoomOut size={15} /></button><span>80%</span><button className="icon-button" aria-label="放大"><ZoomIn size={15} /></button><button className="add-button"><Plus size={15} />添加场景</button></div>
        </div>

        {view === 'blueprint' ? (
          <div className="blueprint-canvas">
            <div className="canvas-grid" />
            <svg className="connectors" viewBox="0 0 1240 560" preserveAspectRatio="none" aria-hidden="true">
              {links.map(([fromId, toId]) => { const from = scenes.find((s) => s.id === fromId)!; const to = scenes.find((s) => s.id === toId)!; const x1 = from.x + 212; const y1 = from.y + 58; const x2 = to.x; const y2 = to.y + 58; const mid = (x1 + x2) / 2; return <path key={`${fromId}-${toId}`} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} />; })}
            </svg>
            {scenes.map((scene) => (
              <button key={scene.id} className={`scene-node ${selectedId === scene.id ? 'selected' : ''} ${scene.kind ?? ''}`} style={{ left: scene.x, top: scene.y }} onClick={() => setSelectedId(scene.id)}>
                <span className="node-topline"><small>{scene.chapter}</small><StatusDot status={scene.status} /></span><strong>{scene.title}</strong><span className="node-subtitle">{scene.subtitle}</span><span className="node-footer"><Film size={13} />{scene.duration}<i />{scene.id === 's1' ? '2 个选择' : scene.kind === 'ending' ? '故事结束' : '1 个出口'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="timeline-view">
            <div className="time-ruler"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span><span>00:50</span></div>
            <div className="track-row"><label><Film size={15} />视频</label><button className="clip video-clip">雨夜车站 <span>18s</span></button><button className="clip video-clip alt">信封特写 <span>6s</span></button></div>
            <div className="track-row"><label><MessageSquareText size={15} />对白</label><button className="clip text-clip">“不要上那班车。”</button></div>
            <div className="track-row"><label><GitBranch size={15} />互动</label><button className="clip choice-clip">选择出现 · 2 项</button></div>
            <div className="playhead"><span /></div>
            <div className="timeline-hint"><Sparkles size={17} />系统会根据脚本自动安排镜头、对白和选择出现的时间，你可以继续微调。</div>
          </div>
        )}
      </section>

      <aside className="inspector">
        <div className="inspector-heading"><div><span>{selected.chapter}</span><h2>{selected.title}</h2></div><button className="icon-button" aria-label="更多"><MoreHorizontal size={18} /></button></div>
        <div className="video-frame" role="img" aria-label={`${selected.title} 的视频预览占位帧`}><div className="frame-vignette" /><button className="frame-play" onClick={openPreview}><Play size={18} fill="currentColor" /></button><span>{selected.status === 'ready' ? '视频已生成' : selected.status === 'generating' ? '正在生成镜头…' : '等待生成'}</span><small>{selected.duration}</small></div>
        <div className="field-group"><label htmlFor="scene-script">场景脚本 <span>创作者输入</span></label><textarea id="scene-script" value={selected.script} onChange={(e) => updateScript(e.target.value)} /><div className="script-meta"><span>{selected.script.length} 字</span><button>展开脚本编辑器</button></div></div>
        <div className="field-group compact"><label>视觉与表演</label><button className="select-like"><span><i className="tone-swatch" />{selected.tone}</span><ChevronDown size={14} /></button></div>
        <div className="ai-panel"><div className="ai-heading"><span><WandSparkles size={16} />AI 制作助手</span><small>不改写剧情</small></div><ul><li><span className="check">✓</span>从脚本拆分 4 个镜头</li><li><span className="check">✓</span>保持林夏角色外观一致</li><li><span className="check">✓</span>生成首尾帧与运镜描述</li></ul><button className="generate-button" onClick={generateScene} disabled={selected.status === 'generating'}><Sparkles size={16} />{selected.status === 'generating' ? '正在生成…' : selected.status === 'ready' ? '重新生成视频' : '生成这一场'}</button></div>
      </aside>

      {previewOpen && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="游戏试玩">
          <button className="close-preview" onClick={() => setPreviewOpen(false)} aria-label="关闭试玩"><X size={19} /></button>
          <div className="player-shell"><div className="player-top"><span>试玩模式</span><small>路径：雨夜来信 → 打开信封</small></div><div className="player-stage"><div className="cinema-grain" />
            {previewStep === 'video' && <div className="play-state"><CirclePlay size={50} /><span>片段播放中</span></div>}
            {previewStep === 'choice' && <div className="choice-state"><p>列车缓缓进站。你要相信信上的警告吗？</p><button onClick={() => setPreviewStep('result')}>去失物招领处寻找寄信人</button><button onClick={() => setPreviewStep('result')}>无视警告，登上末班车</button></div>}
            {previewStep === 'result' && <div className="result-state"><span>信任 +1</span><h3>选择已生效</h3><p>下一场景将根据分支继续播放。</p><button onClick={() => setPreviewStep('choice')}>返回选择</button></div>}
          </div></div>
        </div>
      )}
    </main>
  );
}
