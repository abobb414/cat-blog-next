'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Heart, MessageCircle, PawPrint, Plus, LogIn, Lock, X,
  Trash2, Edit3, UploadCloud, Calendar, Save, Award, Flame, Send, Cookie
} from 'lucide-react';

// ==================== 类型定义 ====================
interface Comment {
  id: string;
  postId: string;
  author: string;
  content: string;
  createdAt: string;
}

interface Post {
  id: string;
  date: string;
  content: string;
  image: string | null;
  likes: number;
  comments: Comment[];
}

interface Profile {
  name: string;
  title: string;
  avatar: string;
  bio: string;
  age: string;
  weight: string;
  favoriteSnack: string;
}

// ==================== 默认数据 ====================
const DEFAULT_PROFILE: Profile = {
  name: "咪咪 (Mimi)",
  title: "全职干饭人 / 专业捕蚊官 / 拆家工程师",
  avatar: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80",
  bio: "专注于人类驯化研究长达两年。熟练掌握'凌晨三点跑酷'、'用屁股对着镜头'以及'假装听不懂人话'等核心技术。",
  age: "1.5 岁",
  weight: "4.5 kg",
  favoriteSnack: "冻干高能鸡肉粒"
};

const DEFAULT_POSTS: Post[] = [
  {
    id: "post-1",
    date: "2026-07-07T10:24",
    content: "愚蠢的人类今天居然迟到了5分钟才开罐头。为了表示抗议，我当着他的面把桌上的水杯推了下去。啪，真响。😎",
    image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&auto=format&fit=crop&q=80",
    likes: 42,
    comments: [
      { id: "c1", postId: "post-1", author: "铲屎官", content: "杯子碎了你开心了吧！", createdAt: "2026-07-07T11:00" },
      { id: "c2", postId: "post-1", author: "猫奴小王", content: "哈哈哈哈不愧是主子", createdAt: "2026-07-07T12:30" },
    ],
  },
  {
    id: "post-2",
    date: "2026-06-28T15:40",
    content: "实名举报家里新买的那个扫地机器人。它总是试图挑战我的领地主权。今天我决定骑在它背上巡视客厅，它屈服了，乖乖带着我转了三圈。",
    image: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
    likes: 88,
    comments: [
      { id: "c3", postId: "post-2", author: "路过的喵星人", content: "霸气侧漏！🐱", createdAt: "2026-06-28T16:00" },
    ],
  },
  {
    id: "post-3",
    date: "2026-05-12T09:15",
    content: "愚蠢的人类居然想带我去打疫苗？本喵直接钻进床底。任凭他怎么用零食诱惑，我自岿然不动。最终计划通，人类上班迟到了，哈哈！",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80",
    likes: 120,
    comments: [],
  }
];

// ==================== 工具函数 ====================
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTimeLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDateTime(dateStr);
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 生成一个浏览器指纹作为用户标识（模拟 Cloudflare CF-Connecting-IP）
function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'cat-blog-visitor-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'visitor-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// ==================== 主组件 ====================
export default function CatBlogFullMVP() {
  // 核心状态
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // UI 状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  // 表单状态
  const [passwordInput, setPasswordInput] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [profileForm, setProfileForm] = useState<Profile>(DEFAULT_PROFILE);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({});

  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 初始化：从 localStorage 加载（兼容旧数据缺少 comments 字段）
  useEffect(() => {
    const loaded = loadFromStorage<any[]>('cat-posts', DEFAULT_POSTS);
    const migrated = loaded.map(p => ({ ...p, comments: p.comments || [] }));
    setPosts(migrated);
    setProfile(loadFromStorage('cat-profile', DEFAULT_PROFILE));
    setLikedPostIds(new Set(loadFromStorage<string[]>('cat-liked-ids', [])));
    setNewDate(new Date().toISOString().slice(0, 16));
  }, []);

  // 持久化
  useEffect(() => {
    if (posts.length > 0) localStorage.setItem('cat-posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('cat-profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('cat-liked-ids', JSON.stringify([...likedPostIds]));
  }, [likedPostIds]);

  // ==================== 点赞切换 ====================
  const handleLikeToggle = (postId: string) => {
    const alreadyLiked = likedPostIds.has(postId);
    const newLiked = new Set(likedPostIds);

    if (alreadyLiked) {
      // 取消点赞
      newLiked.delete(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
    } else {
      // 首次点赞
      newLiked.add(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    }
    setLikedPostIds(newLiked);
  };

  // ==================== 评论操作 ====================
  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    const author = commentAuthors[postId]?.trim() || '热心路人';

    const newComment: Comment = {
      id: generateId('comment'),
      postId,
      author,
      content,
      createdAt: new Date().toISOString(),
    };

    setPosts(posts.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    setCommentInputs({ ...commentInputs, [postId]: '' });
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p));
  };

  // ==================== 动态操作 ====================
  const handleCreatePost = () => {
    if (!newContent.trim()) return;
    const newPost: Post = {
      id: generateId('post'),
      date: newDate || new Date().toISOString().slice(0, 16),
      content: newContent,
      image: newImagePreview || null,
      likes: 0,
      comments: [],
    };
    setPosts([newPost, ...posts]);
    setNewContent('');
    setNewImagePreview('');
    setNewDate(new Date().toISOString().slice(0, 16));
  };

  const handleDeletePost = (id: string) => {
    if (!confirm('确定要删除这条动态吗？😿')) return;
    setPosts(posts.filter(p => p.id !== id));
  };

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditDate(post.date);
    setEditImagePreview(post.image || '');
  };

  const handleSaveEdit = () => {
    if (!editingPostId) return;
    setPosts(posts.map(p => p.id === editingPostId ? {
      ...p,
      content: editContent,
      date: editDate,
      image: editImagePreview || null,
    } : p));
    setEditingPostId(null);
    setEditContent('');
    setEditImagePreview('');
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditImagePreview('');
  };

  // ==================== 图片处理 ====================
  const handleNewImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImagePreview(await imageToBase64(file));
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImagePreview(await imageToBase64(file));
  };

  // ==================== 登录 ====================
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Changk0119') {
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setPasswordInput('');
    } else {
      alert('铲屎官暗号错误！😿');
    }
  };

  // ==================== 个人档案编辑 ====================
  const openProfileEditor = () => {
    setProfileForm({ ...profile });
    setShowProfileEditor(true);
  };

  const handleSaveProfile = () => {
    setProfile({ ...profileForm });
    setShowProfileEditor(false);
  };

  const handleProfileAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileForm({ ...profileForm, avatar: await imageToBase64(file) });
  };

  // ==================== 时间轴定位 ====================
  const scrollToPost = (id: string) => {
    postRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 排序
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-amber-50/40 text-stone-800 font-sans selection:bg-amber-200 relative">

      {/* ========== 顶部 Banner ========== */}
      <div className="h-48 w-full bg-gradient-to-r from-amber-200 to-orange-300 flex items-center justify-center">
        <div className="flex items-center gap-2 text-orange-900/60 font-semibold tracking-wider">
          <PawPrint className="w-5 h-5 animate-bounce" />
          <span>WELCOME TO CAT&apos;S SPACE</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* ========== 个人档案卡片 ========== */}
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
                {isLoggedIn && (
                  <button onClick={openProfileEditor} className="text-stone-400 hover:text-orange-500 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
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

        {/* ========== 主体：时间轴 + 动态流 ========== */}
        <div className="mt-12 flex gap-8 items-start">

          {/* 左侧垂直时间轴 */}
          <aside className="hidden md:block w-48 sticky top-6 bg-white/80 backdrop-blur p-4 rounded-2xl border border-stone-100 shadow-sm">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 px-2">时光轨迹</h3>
            <div className="relative border-l-2 border-amber-200 ml-2 space-y-4 py-2">
              {sortedPosts.map((post) => (
                <div key={post.id} className="relative pl-4 group">
                  <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white group-hover:bg-orange-500 transition-colors" />
                  <button onClick={() => scrollToPost(post.id)} className="text-left text-sm text-stone-600 hover:text-orange-500 hover:font-semibold transition-all block truncate w-full">
                    {getTimeLabel(post.date)}
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* 右侧动态流 */}
          <div className="flex-1 space-y-8 max-w-2xl mx-auto w-full">

            {/* ===== 管理员发帖框 ===== */}
            {isLoggedIn && (
              <div className="bg-orange-50/60 border-2 border-dashed border-orange-200 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-orange-800">✨ 铲屎官模式已激活，记录主子新瞬间</div>
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="今天主子又干了什么坏事？" className="w-full p-3 rounded-xl border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white" rows={3} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-orange-100 cursor-pointer hover:bg-orange-50 transition-colors">
                    <UploadCloud className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="text-stone-500 truncate">{newImagePreview ? '✅ 照片已就绪（点击更换）' : '选择本地猫咪照片'}</span>
                    <input type="file" accept="image/*" onChange={handleNewImageSelect} className="hidden" />
                  </label>
                  <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-orange-100">
                    <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                    <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full focus:outline-none bg-transparent text-stone-700" />
                  </div>
                </div>
                {newImagePreview && (
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border-2 border-orange-200">
                    <img src={newImagePreview} alt="预览" className="w-full h-full object-cover" />
                    <button onClick={() => setNewImagePreview('')} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleCreatePost} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 发布动态
                  </button>
                </div>
              </div>
            )}

            {/* ===== 动态卡片列表 ===== */}
            {sortedPosts.map((post) => {
              const isLiked = likedPostIds.has(post.id);
              const isCommentsOpen = expandedComments.has(post.id);

              return (
                <article key={post.id} ref={(el) => { postRefs.current[post.id] = el; }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 transition-all hover:shadow-md scroll-mt-6 relative group">

                  {/* 管理操作按钮 */}
                  {isLoggedIn && editingPostId !== post.id && (
                    <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => startEditPost(post)} className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeletePost(post.id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {editingPostId === post.id ? (
                    /* ===== 编辑模式 ===== */
                    <div className="p-5 space-y-3">
                      <div className="text-xs font-bold text-amber-700 flex items-center gap-1"><Edit3 className="w-3 h-3" /> 编辑动态</div>
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" rows={3} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border cursor-pointer hover:bg-amber-50">
                          <UploadCloud className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-stone-500 truncate">{editImagePreview ? '✅ 已有照片（点击更换）' : '更换照片'}</span>
                          <input type="file" accept="image/*" onChange={handleEditImageSelect} className="hidden" />
                        </label>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border">
                          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                          <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full focus:outline-none bg-transparent" />
                        </div>
                      </div>
                      {editImagePreview && (
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border">
                          <img src={editImagePreview} alt="预览" className="w-full h-full object-cover" />
                          <button onClick={() => setEditImagePreview('')} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button onClick={cancelEdit} className="px-4 py-2 bg-stone-200 text-stone-600 rounded-xl text-xs font-medium hover:bg-stone-300 transition-colors">取消</button>
                        <button onClick={handleSaveEdit} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 hover:bg-amber-600 transition-colors"><Save className="w-3 h-3" /> 保存修改</button>
                      </div>
                    </div>
                  ) : (
                    /* ===== 正常展示模式 ===== */
                    <>
                      <div className="px-6 pt-4 text-xs font-medium text-stone-400 flex justify-between items-center">
                        <span>{formatDateTime(post.date)}</span>
                        <span className="md:hidden bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px]">{getTimeLabel(post.date)}</span>
                      </div>
                      <div className="px-6 pt-2 pb-4 text-stone-700 leading-relaxed text-[15px] whitespace-pre-line">{post.content}</div>
                      {post.image && (
                        <div className="px-6 pb-4">
                          <img src={post.image} alt="动态配图" className="w-full h-64 object-cover rounded-xl bg-stone-50" />
                        </div>
                      )}

                      {/* ===== 互动工具栏 ===== */}
                      <div className="px-6 py-3 bg-stone-50 border-t border-stone-50 flex items-center justify-between text-stone-500 text-sm">
                        <button onClick={() => handleLikeToggle(post.id)} className={`flex items-center gap-2 transition-colors ${isLiked ? 'text-red-500 font-medium' : 'hover:text-red-500'}`}>
                          <Heart className={`w-4 h-4 transition-all ${isLiked ? 'fill-red-500 scale-110' : ''}`} />
                          <span>{post.likes} 个爪印</span>
                        </button>
                        <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-1 transition-colors ${isCommentsOpen ? 'text-amber-600 font-medium' : 'hover:text-amber-600'}`}>
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments.length} 条评论</span>
                        </button>
                      </div>

                      {/* ===== 评论展开区 ===== */}
                      {isCommentsOpen && (
                        <div className="bg-stone-50/50 border-t border-stone-100 px-6 py-4 space-y-4">
                          {/* 评论列表 */}
                          {post.comments.length > 0 ? (
                            <div className="space-y-2">
                              {post.comments.map((comment) => (
                                <div key={comment.id} className="flex justify-between items-start bg-white p-3 rounded-xl border border-stone-100 group/comment">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-amber-800 text-xs">{comment.author}</span>
                                      <span className="text-[10px] text-stone-400">{formatRelativeTime(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-stone-700 break-words">{comment.content}</p>
                                  </div>
                                  {isLoggedIn && (
                                    <button onClick={() => handleDeleteComment(post.id, comment.id)} className="ml-2 text-red-400 opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0 p-1 hover:bg-red-50 rounded" title="删除评论">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 text-center py-2">还没有评论，来说点什么吧～ 🐾</p>
                          )}

                          {/* 发评论表单 */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="昵称"
                              value={commentAuthors[post.id] || ''}
                              onChange={(e) => setCommentAuthors({ ...commentAuthors, [post.id]: e.target.value })}
                              className="w-20 p-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                            />
                            <input
                              type="text"
                              placeholder="说点什么..."
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                              className="flex-1 p-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                            />
                            <button onClick={() => handleAddComment(post.id)} className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-2.5 rounded-xl transition-colors shrink-0" title="发送">
                              <Send className="w-3.5 h-3.5" />
                            </button>
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

      {/* ========== 右下角悬浮控制台 ========== */}
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

      {/* ========== 登录弹窗 ========== */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-80 shadow-2xl border border-stone-100 relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-1 mb-4"><Lock className="w-4 h-4" /> 身份验证</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">输入铲屎官暗号</label>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="提示：猫咪的名字拼音" className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoFocus />
              </div>
              <button type="submit" className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition-colors">开门！开罐头！</button>
            </form>
          </div>
        </div>
      )}

      {/* ========== 个人档案编辑弹窗 ========== */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-96 max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-100 relative">
            <button onClick={() => setShowProfileEditor(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-stone-900 mb-5">🐾 编辑猫咪档案</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <img src={profileForm.avatar} alt="头像" className="w-20 h-20 rounded-xl object-cover border-2 border-stone-200" />
                  <label className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <UploadCloud className="w-5 h-5 text-white" />
                    <input type="file" accept="image/*" onChange={handleProfileAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-xs text-stone-400">点击头像更换照片</div>
              </div>
              {[
                { key: 'name', label: '名字', placeholder: '咪咪 (Mimi)' },
                { key: 'title', label: '头衔', placeholder: '全职干饭人 / ...' },
                { key: 'bio', label: '简介', placeholder: '介绍一下...', multiline: true },
                { key: 'age', label: '年龄', placeholder: '1.5 岁' },
                { key: 'weight', label: '体重', placeholder: '4.5 kg' },
                { key: 'favoriteSnack', label: '最爱零食', placeholder: '冻干高能鸡肉粒' },
              ].map(({ key, label, placeholder, multiline }) => (
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

      <footer className="text-center text-xs text-stone-400 py-8 border-t border-stone-100">
        © 2026 Crafted with ❤️ for Mimi. Powered by Meow.
      </footer>
    </div>
  );
}
