import { NextRequest, NextResponse } from 'next/server';
import { d1Query, generateId } from '@/lib/cloudflare';

interface CommentRow {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
}

interface PostRow {
  id: string;
  publish_date: string;
  content: string;
  image: string | null;
  likes: number;
}

interface LikeRow {
  post_id: string;
}

type PostMutationBody = Record<string, string | null | undefined>;

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

// GET: 获取所有动态 + 评论 + 当前用户点赞状态
export async function GET(request: NextRequest) {
  try {
    const visitorId = request.headers.get('x-visitor-id') || 'anonymous';

    const posts = await d1Query('SELECT * FROM posts ORDER BY publish_date DESC') as unknown as PostRow[];
    const comments = await d1Query('SELECT * FROM comments ORDER BY created_at ASC') as unknown as CommentRow[];
    const likedRows = await d1Query('SELECT post_id FROM likes WHERE visitor_id = ?', [visitorId]) as unknown as LikeRow[];
    const likedSet = new Set(likedRows.map((r) => r.post_id));

    const fullPosts = posts.map((post) => ({
      ...post,
      comments: comments.filter((c) => c.post_id === post.id),
      hasLiked: likedSet.has(post.id),
    }));

    return NextResponse.json(fullPosts);
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

// POST: 发布新动态
export async function POST(request: NextRequest) {
  try {
    const { content, image, publish_date } = await request.json();
    const id = generateId('post');

    await d1Query(
      'INSERT INTO posts (id, content, image, publish_date, likes) VALUES (?, ?, ?, ?, 0)',
      [id, content, image || null, publish_date]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

// PUT: 点赞切换 / 编辑 / 删除 / 评论操作
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as PostMutationBody;
    const { action } = body;
    const visitorId = request.headers.get('x-visitor-id') || 'anonymous';

    if (action === 'like') {
      const { post_id } = body;
      const existing = await d1Query(
        'SELECT id FROM likes WHERE post_id = ? AND visitor_id = ?',
        [post_id, visitorId]
      );
      if (existing.length > 0) {
        await d1Query('DELETE FROM likes WHERE post_id = ? AND visitor_id = ?', [post_id, visitorId]);
        await d1Query('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?', [post_id]);
        return NextResponse.json({ success: true, liked: false });
      } else {
        const likeId = generateId('like');
        await d1Query('INSERT INTO likes (id, post_id, visitor_id) VALUES (?, ?, ?)', [likeId, post_id, visitorId]);
        await d1Query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [post_id]);
        return NextResponse.json({ success: true, liked: true });
      }
    }

    if (action === 'edit') {
      const { id, content, image, publish_date } = body;
      await d1Query(
        'UPDATE posts SET content = ?, image = ?, publish_date = ? WHERE id = ?',
        [content, image || null, publish_date, id]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      await d1Query('DELETE FROM comments WHERE post_id = ?', [id]);
      await d1Query('DELETE FROM likes WHERE post_id = ?', [id]);
      await d1Query('DELETE FROM posts WHERE id = ?', [id]);
      return NextResponse.json({ success: true });
    }

    if (action === 'add_comment') {
      const { post_id, author, content } = body;
      const commentId = generateId('comment');
      await d1Query(
        'INSERT INTO comments (id, post_id, author, content) VALUES (?, ?, ?, ?)',
        [commentId, post_id, author || '热心路人', content]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_comment') {
      const { id } = body;
      await d1Query('DELETE FROM comments WHERE id = ?', [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
