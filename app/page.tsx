'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Heart, MessageCircle, PawPrint, Plus, LogIn, Lock, X,
  Trash2, Edit3, UploadCloud, Save, Award, Flame, Cookie, Send, Loader2, Check, AlertCircle
} from 'lucide-react';
import { compressImage, describeCompression } from '@/lib/compress-image';
import DateTimePicker from '@/components/DateTimePicker';

// ==================== 类型 ====================
interface Comment { id: string; post_id: string; author: string; content: string; created_at: string; }
interface Post { id: string; publish_date: string; content: string; image: string | null; likes: number; comments: Comment[]; hasLiked: boolean; }
interface CatProfile { name: string; title: string; avatar: string; bio: string; age: string; weight: string; favoriteSnack: string; }

const defaultProfile: CatProfile = {
  name: '朵朵 (Duoduo)',
  title: '待填写 / 待填写 / 待填写',
  avatar: 'https://pub-05f42b49e85744fea96d9e69292c1ad7.r2.dev/default-avatar.png',
  bio: '这里是朵朵的自我介绍，登录后点名字旁边的铅笔图标就能改。',
  age: '待填写',
  weight: '待填写',
  favoriteSnack: '待填写',
};

const profileFields: Array<{ key: keyof CatProfile; label: string; placeholder: string; multiline: boolean }> = [
  { key: 'name', label: '名字', placeholder: '朵朵 (Duoduo)', multiline: false },
  { key: 'title', label: '头衔', placeholder: '待填写 / 待填写 / 待填写', multiline: false },
  { key: 'bio', label: '简介', placeholder: '介绍一下...', multiline: true },
  { key: 'age', label: '年龄', placeholder: '待填写', multiline: false },
  { key: 'weight', label: '体重', placeholder: '待填写', multiline: false },
  { key: 'favoriteSnack', label: '最爱零食', placeholder: '待填写', multiline: false },
];

// ==================== Visitor ID ====================
function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'cat-visitor-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'v-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// ==================== 工具函数 ====================
function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function getTimeLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} 天前` : formatDateTime(dateStr);
}
/** <input type="datetime-local"> 要的是**本地**时间；
 *  早先用 toISOString().slice(0,16) 给的是 UTC，会比本地早 8 小时 */
function localDateTimeValue(date: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function PostImage({ src }: { src: string }) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait' | 'square' | null>(null);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.naturalHeight > image.naturalWidth * 1.05) {
      setOrientation('portrait');
    } else if (image.naturalWidth > image.naturalHeight * 1.05) {
      setOrientation('landscape');
    } else {
      setOrientation('square');
    }
  };

  const imageClass =
    orientation === 'portrait'
      ? 'mx-auto max-h-[72vh] w-auto max-w-full object-contain'
      : 'h-auto max-h-[560px] w-full object-contain';

  return (
    <div className="rounded-xl bg-mist overflow-hidden border border-line">
      <img
        src={src}
        alt="动态配图"
        onLoad={handleLoad}
        className={`block ${imageClass}`}
      />
    </div>
  );
}

// ==================== 主组件 ====================
export default function CatBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI 状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  // 深色模式：实际初值由 layout 的内联脚本决定，挂载后同步过来（避免水合不一致）
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem('theme', next); } catch { /* 隐私模式忽略 */ }
      return next;
    });
  }, []);

  // 拉绳：拉动中防重入；灯在绳子拉到最低点时切换（keyframes 28% ≈ 210ms）
  const [pulling, setPulling] = useState(false);
  const pullLockRef = useRef(false);
  const handlePull = useCallback(() => {
    if (pullLockRef.current) return;
    pullLockRef.current = true;
    setPulling(true);
    window.setTimeout(toggleTheme, 180);
    window.setTimeout(() => {
      setPulling(false);
      pullLockRef.current = false;
    }, 780);
  }, [toggleTheme]);

  // 表单
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState(() => localDateTimeValue());
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [profile, setProfile] = useState<CatProfile>(defaultProfile);
  const [profileForm, setProfileForm] = useState<CatProfile>(defaultProfile);

  // 内联轻提示 —— 替代原生 alert / confirm，原生弹窗在这套浅色版式里最扎眼
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // 各上传位压缩前后的体积说明
  const [uploadInfo, setUploadInfo] = useState<Record<string, string>>({});

  const postRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const visitorId = useRef('');
  // 预览用的 objectURL 按"上传位"记账，换图或卸载时逐一回收，避免内存泄漏
  const previewUrls = useRef<Record<string, string>>({});

  const setPreviewUrl = useCallback((slot: string, blob: Blob) => {
    const prev = previewUrls.current[slot];
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(blob);
    previewUrls.current[slot] = url;
    return url;
  }, []);

  const clearPreviewUrl = useCallback((slot: string) => {
    const prev = previewUrls.current[slot];
    if (prev) {
      URL.revokeObjectURL(prev);
      delete previewUrls.current[slot];
    }
  }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // 轻提示 4 秒自动消失
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // ==================== API 调用 ====================
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts', { headers: { 'x-visitor-id': visitorId.current } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 接口异常时返回的是 { error } 对象，直接用会让 posts.map 崩溃成白屏
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setPosts([]);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data: CatProfile = await res.json();
      // 接口异常时会返回 [] 或 { error }，直接塞进去会让档案卡片整块变空白
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.name) {
        throw new Error('Unexpected profile payload');
      }
      setProfile(data);
      setProfileForm(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    visitorId.current = getVisitorId();
    async function loadInitialData() {
      await Promise.all([fetchPosts(), fetchProfile()]);
      if (!cancelled) setLoading(false);
    }
    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [fetchPosts, fetchProfile]);

  // 登录验证
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setPasswordInput('');
      } else {
        setLoginError(data.error || '暗号错误！');
      }
    } catch {
      setLoginError('网络错误，请重试');
    }
  };

  // 点赞切换
  const handleLikeToggle = async (postId: string) => {
    // 乐观更新
    setPosts(posts.map(p => p.id === postId ? {
      ...p,
      hasLiked: !p.hasLiked,
      likes: p.hasLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
    } : p));
    try {
      await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-visitor-id': visitorId.current },
        body: JSON.stringify({ post_id: postId, action: 'like' }),
      });
    } catch {
      fetchPosts(); // 回滚
    }
  };

  // 评论
  const toggleComments = (postId: string) => {
    const s = new Set(expandedComments);
    if (s.has(postId)) {
      s.delete(postId);
    } else {
      s.add(postId);
    }
    setExpandedComments(s);
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    const author = commentAuthors[postId]?.trim() || '热心路人';
    try {
      await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, author, content, action: 'add_comment' }),
      });
      setCommentInputs({ ...commentInputs, [postId]: '' });
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch('/api/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId, action: 'delete_comment' }),
    });
    fetchPosts();
  };

  // 发布动态
  const handleCreatePost = async () => {
    if (!newContent.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, image: newImageUrl || null, publish_date: newDate }),
      });
      setNewContent('');
      setNewImagePreview('');
      setNewImageUrl('');
      setNewDate(localDateTimeValue());
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 编辑/删除动态
  const handleDeletePost = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      fetchPosts();
    } catch {
      setNotice({ kind: 'error', text: '删除失败，请重试' });
    }
  };

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditDate(post.publish_date);
    setEditImagePreview(post.image || '');
    setEditImageUrl(post.image || '');
  };

  const handleSaveEdit = async () => {
    if (!editingPostId) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPostId, content: editContent, image: editImageUrl || null, publish_date: editDate, action: 'edit' }),
      });
      setEditingPostId(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 统一的上传出口
  const uploadToR2 = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || '上传失败');
    return data.url as string;
  };

  // 图片上传：先在浏览器里压缩，再传 R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await compressImage(file, 'post');
      // 预览直接用压缩后的产物，顺带省掉一份大 base64 常驻内存
      const previewUrl = setPreviewUrl(target, result.file);
      if (target === 'new') setNewImagePreview(previewUrl);
      else setEditImagePreview(previewUrl);

      const url = await uploadToR2(result.file);
      if (target === 'new') setNewImageUrl(url);
      else setEditImageUrl(url);

      setUploadInfo((s) => ({
        ...s,
        [target]: result.compressed ? describeCompression(result) : result.reason || '未压缩',
      }));
    } catch (err) {
      clearPreviewUrl(target);
      if (target === 'new') {
        setNewImagePreview('');
        setNewImageUrl('');
      } else {
        setEditImagePreview('');
        setEditImageUrl('');
      }
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : '图片上传失败，请重试' });
    } finally {
      // 清空 value，保证连着选同一张图也能触发 change
      input.value = '';
      setIsUploading(false);
    }
  };

  // Profile
  const openProfileEditor = () => { setProfileForm({ ...profile }); setShowProfileEditor(true); };
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) throw new Error('保存失败');
      const savedProfile: CatProfile = await res.json();
      setProfile(savedProfile);
      setProfileForm(savedProfile);
      setShowProfileEditor(false);
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: '档案保存失败，请重试' });
    } finally {
      setIsSavingProfile(false);
    }
  };
  const handleProfileAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const previousAvatar = profileForm.avatar;
    try {
      const result = await compressImage(file, 'avatar');
      setProfileForm((current) => ({ ...current, avatar: setPreviewUrl('avatar', result.file) }));

      const url = await uploadToR2(result.file);
      setProfileForm((current) => ({ ...current, avatar: url }));

      setUploadInfo((s) => ({
        ...s,
        avatar: result.compressed ? describeCompression(result) : result.reason || '未压缩',
      }));
    } catch (err) {
      console.error(err);
      clearPreviewUrl('avatar');
      setProfileForm((current) => ({ ...current, avatar: previousAvatar }));
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : '头像上传失败，请重试' });
    } finally {
      input.value = '';
      setIsUploading(false);
    }
  };

  const scrollToPost = (id: string) => { postRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const sortedPosts = [...posts].sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>小猫正在加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-brand-soft relative flex flex-col">

      {/* Banner */}
      <div className="h-48 w-full bg-gradient-to-br from-brand-tint via-brand-soft/75 to-brand-tint flex items-center justify-center">
        {/* 拉绳开关：细绳从视口顶端垂下，颜色与拉环素材一致（纯黑，深色下一起反白） */}
        <button
          onClick={handlePull}
          title={theme === 'dark' ? '拉一下：开灯' : '拉一下：关灯'}
          aria-label={theme === 'dark' ? '拉一下：切换到浅色模式' : '拉一下：切换到深色模式'}
          className="fixed top-0 right-5 md:right-8 z-40 flex flex-col items-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-line rounded-b-lg"
        >
          {/* 绳子 + 拉环：绳顶钉住伸长，拉环同步下移，任意时刻保持连接；无 hover 变色 */}
          <span className={`flex flex-col items-center ${pulling ? 'cord-pulling' : ''}`} aria-hidden>
            <span className="cord-rope block w-[2px] h-14 bg-black dark:invert" />
            <img
              src="/icons8/hang-pull.png"
              alt=""
              draggable={false}
              className="cord-ring w-8 h-8 -mt-1 dark:invert"
            />
          </span>
        </button>
        <div className="flex items-center gap-2.5 text-brand-deep/55">
          <img src="/icons8/paw-brand-deep.png" alt="" aria-hidden className="w-5 h-5 opacity-60" />
          <span className="text-meta font-semibold tracking-[0.22em]">WELCOME TO DUODUO&apos;S SPACE</span>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-4 pb-16 flex-1">
        {/* 个人档案 */}
        <div className="relative -mt-20 bg-surface rounded-3xl p-6 shadow-lg shadow-brand-tint/60 border border-brand-tint flex flex-col md:flex-row gap-6 items-center md:items-start z-10">
          <div className="relative group">
            <img src={profile.avatar} alt={profile.name} className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-4 border-surface shadow-md" />
            {isLoggedIn && (
              <button onClick={openProfileEditor} className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit3 className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <h1 className="text-hero font-bold text-ink flex items-center justify-center md:justify-start gap-2">
                {profile.name}
                {isLoggedIn && <button onClick={openProfileEditor} className="text-ink-faint hover:text-brand transition-colors"><Edit3 className="w-4 h-4" /></button>}
              </h1>
              <p className="text-meta font-medium text-brand-deep mt-1">{profile.title}</p>
            </div>
            <p className="text-ink-soft text-body">{profile.bio}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-tint text-brand-deep text-meta font-medium rounded-full"><Award className="w-3 h-3" /> 年龄: {profile.age}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-tint text-brand-deep text-meta font-medium rounded-full"><Flame className="w-3 h-3" /> 体重: {profile.weight}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-tint text-brand-deep text-meta font-medium rounded-full"><Cookie className="w-3 h-3" /> 最爱: {profile.favoriteSnack}</span>
            </div>
          </div>
        </div>

        {/* 主体 */}
        <div className="mt-12 flex gap-8 items-start">
          {/* 时间轴 */}
          <aside className="hidden md:block w-48 sticky top-6 bg-surface/80 backdrop-blur p-4 rounded-2xl border border-line shadow-sm">
            <h3 className="text-meta font-bold text-ink-faint uppercase tracking-wider mb-4 px-2">时光轨迹</h3>
            <div className="relative border-l-2 border-brand-soft ml-2 space-y-4 py-2">
              {sortedPosts.map((post) => (
                <div key={post.id} className="relative pl-4 group">
                  <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-brand border-2 border-surface group-hover:bg-brand transition-colors" />
                  <button onClick={() => scrollToPost(post.id)} className="text-left text-meta text-ink-soft hover:text-brand hover:font-semibold transition-all block truncate w-full">{getTimeLabel(post.publish_date)}</button>
                </div>
              ))}
            </div>
          </aside>

          {/* 动态流 */}
          <div className="flex-1 space-y-8 max-w-2xl mx-auto w-full">

            {/* 发帖框 */}
            {isLoggedIn && (
              <div className="bg-brand-tint/50 border border-dashed border-brand-soft rounded-2xl p-5 space-y-4">
                <div className="text-meta font-bold text-brand-deep">铲屎官模式已激活，记录主子新瞬间</div>
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="今天主子又干了什么坏事？" className="w-full p-3 rounded-xl border border-brand-tint text-body focus:outline-none focus:ring-2 focus:ring-brand resize-none bg-surface" rows={3} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-meta">
                  <label className="flex items-center gap-2 bg-surface px-3 py-2.5 rounded-xl border border-brand-tint cursor-pointer hover:bg-brand-tint transition-colors">
                    {isUploading
                      ? <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                      : newImagePreview
                        ? <Check className="w-4 h-4 text-brand shrink-0" />
                        : <UploadCloud className="w-4 h-4 text-brand shrink-0" />}
                    <span className="text-ink-soft truncate">{newImagePreview ? '照片已就绪（点击更换）' : '选择本地猫咪照片'}</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'new')} className="hidden" />
                  </label>
                  <DateTimePicker value={newDate} onChange={setNewDate} tone="brand" />
                </div>
                {uploadInfo.new && <p className="text-tiny text-ink-faint">图片体积 {uploadInfo.new}</p>}
                {newImagePreview && (
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-brand-soft">
                    <img src={newImagePreview} alt="预览" className="w-full h-full object-cover" />
                    <button onClick={() => { clearPreviewUrl('new'); setNewImagePreview(''); setNewImageUrl(''); setUploadInfo((s) => ({ ...s, new: '' })); }} className="absolute top-1 right-1 bg-black/55 text-white rounded-full p-0.5 hover:bg-black/75 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleCreatePost} disabled={isSubmitting} className="px-5 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl text-meta font-medium flex items-center gap-1 shadow-sm shadow-brand/20 transition-colors">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 发布动态
                  </button>
                </div>
              </div>
            )}

            {/* 动态列表 */}
            {sortedPosts.map((post) => {
              const isCommentsOpen = expandedComments.has(post.id);
              return (
                <article key={post.id} ref={(el) => { postRefs.current[post.id] = el; }} className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-line transition-all hover:shadow-md scroll-mt-6 relative group">
                  {isLoggedIn && editingPostId !== post.id && (
                    <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => startEditPost(post)} className="p-1.5 bg-brand-tint text-brand-deep rounded-lg hover:bg-brand-soft transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPendingDeleteId(post.id)} className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {editingPostId === post.id ? (
                    <div className="p-5 space-y-3">
                      <div className="text-meta font-bold text-brand-deep flex items-center gap-1"><Edit3 className="w-3 h-3" /> 编辑动态</div>
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 rounded-xl border border-brand-soft text-body focus:outline-none focus:ring-2 focus:ring-brand resize-none" rows={3} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-meta">
                        <label className="flex items-center gap-2 bg-surface px-3 py-2 rounded-xl border border-line cursor-pointer hover:bg-brand-tint transition-colors">
                          {isUploading
                            ? <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                            : editImagePreview
                              ? <Check className="w-4 h-4 text-brand shrink-0" />
                              : <UploadCloud className="w-4 h-4 text-brand shrink-0" />}
                          <span className="text-ink-soft truncate">{editImagePreview ? '已有照片（点击更换）' : '更换照片'}</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'edit')} className="hidden" />
                        </label>
                        <DateTimePicker value={editDate} onChange={setEditDate} tone="neutral" />
                      </div>
                      {uploadInfo.edit && <p className="text-tiny text-ink-faint">图片体积 {uploadInfo.edit}</p>}
                      {editImagePreview && (
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-line">
                          <img src={editImagePreview} alt="预览" className="w-full h-full object-cover" />
                          <button onClick={() => { clearPreviewUrl('edit'); setEditImagePreview(''); setEditImageUrl(''); setUploadInfo((s) => ({ ...s, edit: '' })); }} className="absolute top-1 right-1 bg-black/55 text-white rounded-full p-0.5 hover:bg-black/75 transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPostId(null)} className="px-4 py-2 bg-line text-ink-soft rounded-xl text-meta font-medium hover:bg-ink/10 transition-colors">取消</button>
                        <button onClick={handleSaveEdit} disabled={isSubmitting} className="px-4 py-2 bg-brand text-white rounded-xl text-meta font-medium flex items-center gap-1 hover:bg-brand-hover disabled:opacity-50 transition-colors">
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} 保存修改
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-6 pt-4 text-meta font-medium text-ink-faint flex justify-between items-center">
                        <span>{formatDateTime(post.publish_date)}</span>
                        <span className="md:hidden bg-brand-tint text-brand-deep px-2 py-0.5 rounded text-tiny">{getTimeLabel(post.publish_date)}</span>
                      </div>
                      <div className="px-6 pt-2 pb-4 text-ink text-body whitespace-pre-line">{post.content}</div>
                      {post.image && <div className="px-6 pb-4"><PostImage src={post.image} /></div>}
                      <div className="px-6 py-3 bg-mist border-t border-line flex items-center justify-between text-ink-soft text-meta">
                        <button onClick={() => handleLikeToggle(post.id)} className={`flex items-center gap-2 transition-colors ${post.hasLiked ? 'text-accent font-medium' : 'hover:text-accent'}`}>
                          <Heart className={`w-4 h-4 transition-all ${post.hasLiked ? 'fill-accent scale-110' : ''}`} />
                          <span>{post.likes} 个爪印</span>
                        </button>
                        <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-1 transition-colors ${isCommentsOpen ? 'text-brand-deep font-medium' : 'hover:text-brand-deep'}`}>
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments?.length || 0} 条评论</span>
                        </button>
                      </div>
                      {isCommentsOpen && (
                        <div className="bg-mist/60 border-t border-line px-6 py-4 space-y-4">
                          {post.comments?.length > 0 ? (
                            <div className="space-y-2">
                              {post.comments.map((c) => (
                                <div key={c.id} className="flex justify-between items-start bg-surface p-3 rounded-xl border border-line group/comment">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-brand-deep text-meta">{c.author}</span>
                                      <span className="text-tiny text-ink-faint">{formatRelativeTime(c.created_at)}</span>
                                    </div>
                                    <p className="text-body text-ink break-words">{c.content}</p>
                                  </div>
                                  {isLoggedIn && (
                                    <button onClick={() => handleDeleteComment(c.id)} className="ml-2 text-accent opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0 p-1 hover:bg-accent/10 rounded" title="删除评论"><Trash2 className="w-3 h-3" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-meta text-ink-faint text-center py-2">还没有评论，来说点什么吧</p>
                          )}
                          <div className="flex gap-2">
                            <input type="text" placeholder="昵称" value={commentAuthors[post.id] || ''} onChange={(e) => setCommentAuthors({ ...commentAuthors, [post.id]: e.target.value })} className="w-20 p-2.5 rounded-xl border border-line text-meta focus:outline-none focus:ring-2 focus:ring-brand bg-surface" />
                            <input type="text" placeholder="说点什么..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }} className="flex-1 p-2.5 rounded-xl border border-line text-meta focus:outline-none focus:ring-2 focus:ring-brand bg-surface" />
                            <button onClick={() => handleAddComment(post.id)} title="发表评论" aria-label="发表评论" className="bg-brand-tint text-brand-deep hover:bg-brand-soft px-3 py-2.5 rounded-xl transition-colors shrink-0"><Send className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}

            {sortedPosts.length === 0 && (
              <div className="text-center py-16 text-ink-faint">
                {/* 装饰位用 icons8 免费素材，比线稿图标更有温度 */}
                <img src="/icons8/paw-ink-faint.png" alt="" aria-hidden className="w-12 h-12 mx-auto mb-3 opacity-70" />
                <p className="text-meta">还没有动态，铲屎官快来记录第一条吧</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右下角控制台：做成轻量"浮起面板"，不用高饱和实心色块，避免在米白页面上突兀 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
        {showAdminMenu && (
          <div className="flex flex-col items-stretch p-1.5 bg-surface/95 backdrop-blur rounded-2xl border border-line shadow-lg shadow-ink/5">
            {!isLoggedIn ? (
              <button onClick={() => { setShowLoginModal(true); setShowAdminMenu(false); }} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-meta font-medium text-ink-soft hover:text-brand-deep hover:bg-brand-tint transition-colors whitespace-nowrap">
                <LogIn className="w-3.5 h-3.5" /> 铲屎官登录
              </button>
            ) : (
              <button onClick={() => { setIsLoggedIn(false); setShowAdminMenu(false); }} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-meta font-medium text-ink-soft hover:text-accent hover:bg-accent/10 transition-colors whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" /> 退出管理
              </button>
            )}
          </div>
        )}
        <button onClick={() => setShowAdminMenu(!showAdminMenu)} title="管理入口" aria-label="管理入口" aria-expanded={showAdminMenu} className="w-10 h-10 bg-surface/95 backdrop-blur text-ink-soft border border-line rounded-full flex items-center justify-center shadow-lg shadow-ink/5 hover:text-brand-deep hover:border-brand-soft transition-all active:scale-95">
          {showAdminMenu ? <X className="w-4 h-4" /> : <PawPrint className="w-4 h-4" />}
        </button>
      </div>

      {/* 登录弹窗 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-3xl p-6 w-80 shadow-xl border border-line relative">
            <button onClick={() => { setShowLoginModal(false); setLoginError(''); }} aria-label="关闭" className="absolute top-4 right-4 text-ink-faint hover:text-ink-soft transition-colors"><X className="w-4 h-4" /></button>
            <h3 className="text-title font-bold text-ink flex items-center gap-1 mb-4"><Lock className="w-4 h-4" /> 身份验证</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-meta font-medium text-ink-soft block mb-1">输入铲屎官暗号</label>
                <input type="password" value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }} placeholder="请输入暗号" className="w-full px-3 py-2 border border-line rounded-xl text-body focus:outline-none focus:ring-2 focus:ring-brand" autoFocus />
                {loginError && <p className="text-meta text-accent mt-1">{loginError}</p>}
              </div>
              <button type="submit" className="w-full py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-meta font-medium transition-colors">开门！开罐头！</button>
            </form>
          </div>
        </div>
      )}

      {/* 档案编辑弹窗 */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-3xl p-6 w-96 max-h-[90vh] overflow-y-auto shadow-xl border border-line relative">
            <button onClick={() => setShowProfileEditor(false)} aria-label="关闭" className="absolute top-4 right-4 text-ink-faint hover:text-ink-soft transition-colors"><X className="w-4 h-4" /></button>
            <h3 className="text-title font-bold text-ink mb-5">编辑猫咪档案</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group/avatar shrink-0">
                  <img src={profileForm.avatar} alt="头像" className="w-20 h-20 rounded-xl object-cover border border-line" />
                  <label className="absolute inset-0 rounded-xl bg-black/45 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <UploadCloud className="w-5 h-5 text-white" />}
                    <input type="file" accept="image/*" onChange={handleProfileAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-meta text-ink-faint">
                  {isUploading ? '正在压缩并上传…' : '点击头像更换照片'}
                  {uploadInfo.avatar && <span className="block text-tiny mt-0.5">{uploadInfo.avatar}</span>}
                </div>
              </div>
              {profileFields.map(({ key, label, placeholder, multiline }) => (
                <div key={key}>
                  <label className="text-meta font-medium text-ink-soft block mb-1">{label}</label>
                  {multiline ? (
                    <textarea value={profileForm[key]} onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3 py-2 border border-line rounded-xl text-body focus:outline-none focus:ring-2 focus:ring-brand resize-none" rows={3} />
                  ) : (
                    <input type="text" value={profileForm[key]} onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3 py-2 border border-line rounded-xl text-body focus:outline-none focus:ring-2 focus:ring-brand" />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowProfileEditor(false)} className="px-4 py-2 bg-line text-ink-soft rounded-xl text-meta font-medium hover:bg-ink/10">取消</button>
                <button onClick={handleSaveProfile} disabled={isSavingProfile || isUploading} className="px-4 py-2 bg-brand text-white rounded-xl text-meta font-medium flex items-center gap-1 hover:bg-brand-hover disabled:opacity-50">
                  {isSavingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} 保存档案
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认：替代原生 confirm，原生弹窗和这套版式完全不搭 */}
      {pendingDeleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-surface rounded-3xl p-6 w-80 shadow-xl border border-line">
            <h3 className="text-title font-bold text-ink mb-2">删除这条动态？</h3>
            <p className="text-meta text-ink-soft mb-5">删除后无法恢复。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingDeleteId(null)} className="px-4 py-2 bg-line text-ink-soft rounded-xl text-meta font-medium hover:bg-ink/10 transition-colors">取消</button>
              <button onClick={() => handleDeletePost(pendingDeleteId)} className="px-4 py-2 bg-accent text-white rounded-xl text-meta font-medium hover:bg-accent/90 transition-colors">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 轻提示：替代原生 alert */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 w-full max-w-sm pointer-events-none">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border shadow-lg backdrop-blur text-meta font-medium bg-surface/95 ${
            notice.kind === 'error' ? 'border-accent/30 text-accent' : 'border-line text-ink-soft'
          }`}>
            {notice.kind === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
        </div>
      )}

      <footer className="text-center text-meta text-ink-faint py-8 border-t border-line">
        <p>© 2026 Crafted with love for Duoduo. Powered by Meow.</p>
        {/* icons8（igoutu.cn）免费素材许可要求署名并链回网站 */}
        <p className="text-tiny mt-1.5">
          爪印与拉绳图标来自{' '}
          <a href="https://igoutu.cn/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand-deep transition-colors">igoutu.cn</a>
        </p>
      </footer>
    </div>
  );
}
