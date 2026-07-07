'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Heart, MessageCircle, PawPrint, Plus, LogIn, Lock, X,
  Trash2, Edit3, UploadCloud, Calendar, Save, Award, Flame, Cookie, Send, Loader2
} from 'lucide-react';

// ==================== 类型 ====================
interface Comment { id: string; post_id: string; author: string; content: string; created_at: string; }
interface Post { id: string; publish_date: string; content: string; image: string | null; likes: number; comments: Comment[]; hasLiked: boolean; }

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
function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // 表单
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState('');
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

  // Profile (从 localStorage 读，仅前端展示用)
  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cat-profile');
      if (stored) return JSON.parse(stored);
    }
    return { name: '咪咪 (Mimi)', title: '全职干饭人 / 专业捕蚊官 / 拆家工程师', avatar: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80', bio: "专注于人类驯化研究长达两年。熟练掌握'凌晨三点跑酷'、'用屁股对着镜头'以及'假装听不懂人话'等核心技术。", age: '1.5 岁', weight: '4.5 kg', favoriteSnack: '冻干高能鸡肉粒' };
  });
  const [profileForm, setProfileForm] = useState(profile);

  const postRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const visitorId = useRef('');

  // ==================== API 调用 ====================
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts', { headers: { 'x-visitor-id': visitorId.current } });
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, []);

  useEffect(() => {
    visitorId.current = getVisitorId();
    fetchPosts().finally(() => setLoading(false));
    setNewDate(new Date().toISOString().slice(0, 16));
  }, [fetchPosts]);

  useEffect(() => {
    localStorage.setItem('cat-profile', JSON.stringify(profile));
  }, [profile]);

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
    s.has(postId) ? s.delete(postId) : s.add(postId);
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
      setNewDate(new Date().toISOString().slice(0, 16));
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 编辑/删除动态
  const handleDeletePost = async (id: string) => {
    if (!confirm('确定要删除这条动态吗？😿')) return;
    await fetch('/api/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    });
    fetchPosts();
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

  // 图片上传到 R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    // 本地预览
    const base64 = await imageToBase64(file);
    if (target === 'new') setNewImagePreview(base64);
    else setEditImagePreview(base64);
    // 上传到 R2
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        if (target === 'new') setNewImageUrl(data.url);
        else setEditImageUrl(data.url);
      }
    } catch (err) {
      alert('图片上传失败 😿');
    } finally {
      setIsUploading(false);
    }
  };

  // Profile
  const openProfileEditor = () => { setProfileForm({ ...profile }); setShowProfileEditor(true); };
  const handleSaveProfile = () => { setProfile({ ...profileForm }); setShowProfileEditor(false); };
  const handleProfileAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileForm({ ...profileForm, avatar: await imageToBase64(file) });
  };

  const scrollToPost = (id: string) => { postRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const sortedPosts = [...posts].sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50/40 flex items-center justify-center">
        <div className="flex items-center gap-3 text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>小猫正在加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/40 text-stone-800 font-sans selection:bg-amber-200 relative">

      {/* Banner */}
      <div className="h-48 w-full bg-gradient-to-r from-amber-200 to-orange-300 flex items-center justify-center">
        <div className="flex items-center gap-2 text-orange-900/60 font-semibold tracking-wider">
          <PawPrint className="w-5 h-5 animate-bounce" />
          <span>WELCOME TO CAT&apos;S SPACE</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* 个人档案 */}
        <div className="relative -mt-20 bg-white rounded-3xl p-6 shadow-xl shadow-orange-100/50 border border-orange-100 flex flex-col md:flex-row gap-6 items-center md:items-start z-10">
          <div className="relative group">
            <img src={profile.avatar} alt={profile.name} className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-4 border-white shadow-md" />
            {isLoggedIn && (
              <button onClick={openProfileEditor} className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit3 className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 flex items-center justify-center md:justify-start gap-2">
                {profile.name} <span>🐾</span>
                {isLoggedIn && <button onClick={openProfileEditor} className="text-stone-400 hover:text-orange-500 transition-colors"><Edit3 className="w-4 h-4" /></button>}
              </h1>
              <p className="text-sm font-medium text-amber-600 mt-1">{profile.title}</p>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">{profile.bio}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"><Award className="w-3 h-3" /> 年龄: {profile.age}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full"><Flame className="w-3 h-3" /> 体重: {profile.weight}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full"><Cookie className="w-3 h-3" /> 最爱: {profile.favoriteSnack}</span>
            </div>
          </div>
        </div>

        {/* 主体 */}
        <div className="mt-12 flex gap-8 items-start">
          {/* 时间轴 */}
          <aside className="hidden md:block w-48 sticky top-6 bg-white/80 backdrop-blur p-4 rounded-2xl border border-stone-100 shadow-sm">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 px-2">时光轨迹</h3>
            <div className="relative border-l-2 border-amber-200 ml-2 space-y-4 py-2">
              {sortedPosts.map((post) => (
                <div key={post.id} className="relative pl-4 group">
                  <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white group-hover:bg-orange-500 transition-colors" />
                  <button onClick={() => scrollToPost(post.id)} className="text-left text-sm text-stone-600 hover:text-orange-500 hover:font-semibold transition-all block truncate w-full">{getTimeLabel(post.publish_date)}</button>
                </div>
              ))}
            </div>
          </aside>

          {/* 动态流 */}
          <div className="flex-1 space-y-8 max-w-2xl mx-auto w-full">

            {/* 发帖框 */}
            {isLoggedIn && (
              <div className="bg-orange-50/60 border-2 border-dashed border-orange-200 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-orange-800">✨ 铲屎官模式已激活，记录主子新瞬间</div>
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="今天主子又干了什么坏事？" className="w-full p-3 rounded-xl border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white" rows={3} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-orange-100 cursor-pointer hover:bg-orange-50 transition-colors">
                    {isUploading ? <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" /> : <UploadCloud className="w-4 h-4 text-orange-500 shrink-0" />}
                    <span className="text-stone-500 truncate">{newImagePreview ? '✅ 照片已就绪（点击更换）' : '选择本地猫咪照片'}</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'new')} className="hidden" />
                  </label>
                  <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-orange-100">
                    <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                    <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full focus:outline-none bg-transparent text-stone-700" />
                  </div>
                </div>
                {newImagePreview && (
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border-2 border-orange-200">
                    <img src={newImagePreview} alt="预览" className="w-full h-full object-cover" />
                    <button onClick={() => { setNewImagePreview(''); setNewImageUrl(''); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleCreatePost} disabled={isSubmitting} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 发布动态
                  </button>
                </div>
              </div>
            )}

            {/* 动态列表 */}
            {sortedPosts.map((post) => {
              const isCommentsOpen = expandedComments.has(post.id);
              return (
                <article key={post.id} ref={(el) => { postRefs.current[post.id] = el; }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 transition-all hover:shadow-md scroll-mt-6 relative group">
                  {isLoggedIn && editingPostId !== post.id && (
                    <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => startEditPost(post)} className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeletePost(post.id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {editingPostId === post.id ? (
                    <div className="p-5 space-y-3">
                      <div className="text-xs font-bold text-amber-700 flex items-center gap-1"><Edit3 className="w-3 h-3" /> 编辑动态</div>
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" rows={3} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border cursor-pointer hover:bg-amber-50">
                          <UploadCloud className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-stone-500 truncate">{editImagePreview ? '✅ 已有照片（点击更换）' : '更换照片'}</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'edit')} className="hidden" />
                        </label>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border">
                          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                          <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full focus:outline-none bg-transparent" />
                        </div>
                      </div>
                      {editImagePreview && (
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border">
                          <img src={editImagePreview} alt="预览" className="w-full h-full object-cover" />
                          <button onClick={() => { setEditImagePreview(''); setEditImageUrl(''); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPostId(null)} className="px-4 py-2 bg-stone-200 text-stone-600 rounded-xl text-xs font-medium hover:bg-stone-300">取消</button>
                        <button onClick={handleSaveEdit} disabled={isSubmitting} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 hover:bg-amber-600 disabled:opacity-50">
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} 保存修改
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-6 pt-4 text-xs font-medium text-stone-400 flex justify-between items-center">
                        <span>{formatDateTime(post.publish_date)}</span>
                        <span className="md:hidden bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px]">{getTimeLabel(post.publish_date)}</span>
                      </div>
                      <div className="px-6 pt-2 pb-4 text-stone-700 leading-relaxed text-[15px] whitespace-pre-line">{post.content}</div>
                      {post.image && <div className="px-6 pb-4"><img src={post.image} alt="动态配图" className="w-full h-64 object-cover rounded-xl bg-stone-50" /></div>}
                      <div className="px-6 py-3 bg-stone-50 border-t border-stone-50 flex items-center justify-between text-stone-500 text-sm">
                        <button onClick={() => handleLikeToggle(post.id)} className={`flex items-center gap-2 transition-colors ${post.hasLiked ? 'text-red-500 font-medium' : 'hover:text-red-500'}`}>
                          <Heart className={`w-4 h-4 transition-all ${post.hasLiked ? 'fill-red-500 scale-110' : ''}`} />
                          <span>{post.likes} 个爪印</span>
                        </button>
                        <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-1 transition-colors ${isCommentsOpen ? 'text-amber-600 font-medium' : 'hover:text-amber-600'}`}>
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments?.length || 0} 条评论</span>
                        </button>
                      </div>
                      {isCommentsOpen && (
                        <div className="bg-stone-50/50 border-t border-stone-100 px-6 py-4 space-y-4">
                          {post.comments?.length > 0 ? (
                            <div className="space-y-2">
                              {post.comments.map((c) => (
                                <div key={c.id} className="flex justify-between items-start bg-white p-3 rounded-xl border border-stone-100 group/comment">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-amber-800 text-xs">{c.author}</span>
                                      <span className="text-[10px] text-stone-400">{formatRelativeTime(c.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-stone-700 break-words">{c.content}</p>
                                  </div>
                                  {isLoggedIn && (
                                    <button onClick={() => handleDeleteComment(c.id)} className="ml-2 text-red-400 opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0 p-1 hover:bg-red-50 rounded" title="删除评论"><Trash2 className="w-3 h-3" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 text-center py-2">还没有评论，来说点什么吧～ 🐾</p>
                          )}
                          <div className="flex gap-2">
                            <input type="text" placeholder="昵称" value={commentAuthors[post.id] || ''} onChange={(e) => setCommentAuthors({ ...commentAuthors, [post.id]: e.target.value })} className="w-20 p-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
                            <input type="text" placeholder="说点什么..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }} className="flex-1 p-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
                            <button onClick={() => handleAddComment(post.id)} className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-2.5 rounded-xl transition-colors shrink-0"><Send className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}

            {sortedPosts.length === 0 && (
              <div className="text-center py-16 text-stone-400">
                <PawPrint className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">还没有动态，铲屎官快来记录第一条吧！</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右下角控制台 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <button onClick={() => setShowAdminMenu(!showAdminMenu)} className="w-10 h-10 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-stone-700 transition-all active:scale-95" title="管理入口">
          {showAdminMenu ? <X className="w-4 h-4" /> : <PawPrint className="w-4 h-4" />}
        </button>
        {showAdminMenu && (
          <div className="flex flex-col gap-2">
            {!isLoggedIn ? (
              <button onClick={() => { setShowLoginModal(true); setShowAdminMenu(false); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-medium shadow-md transition-colors">
                <LogIn className="w-3.5 h-3.5" /> 铲屎官登录
              </button>
            ) : (
              <button onClick={() => { setIsLoggedIn(false); setShowAdminMenu(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-medium shadow-md transition-colors">
                <Lock className="w-3.5 h-3.5" /> 退出管理
              </button>
            )}
          </div>
        )}
      </div>

      {/* 登录弹窗 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-80 shadow-2xl border border-stone-100 relative">
            <button onClick={() => { setShowLoginModal(false); setLoginError(''); }} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-1 mb-4"><Lock className="w-4 h-4" /> 身份验证</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">输入铲屎官暗号</label>
                <input type="password" value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }} placeholder="请输入暗号" className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoFocus />
                {loginError && <p className="text-xs text-red-500 mt-1">{loginError}</p>}
              </div>
              <button type="submit" className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition-colors">开门！开罐头！</button>
            </form>
          </div>
        </div>
      )}

      {/* 档案编辑弹窗 */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-96 max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-100 relative">
            <button onClick={() => setShowProfileEditor(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-stone-900 mb-5">🐾 编辑猫咪档案</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group/avatar">
                  <img src={profileForm.avatar} alt="头像" className="w-20 h-20 rounded-xl object-cover border-2 border-stone-200" />
                  <label className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <UploadCloud className="w-5 h-5 text-white" />
                    <input type="file" accept="image/*" onChange={handleProfileAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-xs text-stone-400">点击头像更换照片</div>
              </div>
              {([
                { key: 'name', label: '名字', placeholder: '咪咪 (Mimi)', multiline: false },
                { key: 'title', label: '头衔', placeholder: '全职干饭人 / ...', multiline: false },
                { key: 'bio', label: '简介', placeholder: '介绍一下...', multiline: true },
                { key: 'age', label: '年龄', placeholder: '1.5 岁', multiline: false },
                { key: 'weight', label: '体重', placeholder: '4.5 kg', multiline: false },
                { key: 'favoriteSnack', label: '最爱零食', placeholder: '冻干高能鸡肉粒', multiline: false },
              ]).map(({ key, label, placeholder, multiline }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-stone-500 block mb-1">{label}</label>
                  {multiline ? (
                    <textarea value={(profileForm as any)[key]} onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" rows={3} />
                  ) : (
                    <input type="text" value={(profileForm as any)[key]} onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowProfileEditor(false)} className="px-4 py-2 bg-stone-200 text-stone-600 rounded-xl text-xs font-medium hover:bg-stone-300">取消</button>
                <button onClick={handleSaveProfile} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 hover:bg-orange-600"><Save className="w-3 h-3" /> 保存档案</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-stone-400 py-8 border-t border-stone-100">© 2026 Crafted with ❤️ for Mimi. Powered by Meow.</footer>
    </div>
  );
}
