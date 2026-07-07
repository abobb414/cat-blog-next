# 二头的小窝

一个给二头准备的猫咪生活博客。项目使用 Next.js 部署在 Vercel，数据和图片放在 Cloudflare D1 / R2，支持在网页里登录后发布动态、上传照片、编辑猫咪档案、点赞和评论。

线上地址：[https://ertou.abobb.com](https://ertou.abobb.com)

## 功能特性

- 猫咪个人档案：名字、头衔、头像、简介、年龄、体重、最爱零食都存到 Cloudflare D1，电脑和手机看到的是同一份数据。
- 动态时间线：按发布时间倒序展示动态，桌面端有侧边时间轴，手机端在动态卡片里显示月份标签。
- 图片上传：发动态和更换头像时，图片上传到 Cloudflare R2，再把公开图片地址保存到 D1。
- 竖图支持：动态配图会根据图片真实宽高自动适配，竖版生活照不会再被裁成横图。
- 点赞功能：每个访客会生成本地 visitor id，点赞状态保存在 D1，刷新后仍然保持。
- 评论功能：访客可以填写昵称和评论，评论数据保存在 D1。
- 管理员模式：右下角入口登录后，可以发布动态、编辑动态、删除动态、删除评论、编辑猫咪档案。
- 响应式界面：桌面端和手机端使用同一套云端数据，布局会自动适配屏幕宽度。

## 技术架构

```text
浏览器
  |
  | 访问 ertou.abobb.com
  v
Vercel / Next.js App Router
  |
  | Route Handlers 调用 Cloudflare REST API
  v
Cloudflare
  |-- D1：动态、评论、点赞、管理员密码、猫咪档案
  |-- R2：动态图片和头像文件
```

### 前端

- Next.js 16 App Router
- React 19
- Tailwind CSS
- Lucide React Icons

### 后端接口

- `GET /api/posts`：读取动态、评论和当前访客点赞状态
- `POST /api/posts`：发布动态
- `PUT /api/posts`：点赞、编辑动态、删除动态、添加评论、删除评论
- `POST /api/auth`：管理员暗号验证
- `GET /api/profile`：读取猫咪档案
- `PUT /api/profile`：保存猫咪档案
- `POST /api/upload`：上传图片到 R2

## 数据表

Cloudflare D1 使用以下表：

```sql
CREATE TABLE admin (
  id INTEGER PRIMARY KEY,
  password TEXT NOT NULL
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  content TEXT,
  image TEXT,
  publish_date TEXT,
  likes INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  author TEXT,
  content TEXT,
  created_at TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE likes (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  visitor_id TEXT,
  UNIQUE(post_id, visitor_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE cat_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  avatar TEXT NOT NULL,
  bio TEXT NOT NULL,
  age TEXT NOT NULL,
  weight TEXT NOT NULL,
  favorite_snack TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 环境变量

本地开发需要创建 `.env.local`，线上部署需要在 Vercel Production 环境变量里配置同名变量。

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_R2_PUBLIC_URL=
```

说明：

- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
- `CLOUDFLARE_D1_DATABASE_ID`：D1 数据库 ID
- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token，需要有 D1 Edit 和 R2 Edit 权限
- `CLOUDFLARE_R2_PUBLIC_URL`：R2 存储桶公开访问地址

注意：不要把 `.env.local`、API Token、管理员暗号提交到 GitHub。

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

常用检查：

```bash
npm run lint
npm run build
```

## Cloudflare D1 操作

查询远程 D1 数据时一定要加 `--remote`，否则只会操作本地开发库。

```bash
npx wrangler d1 execute mimi-cat-db --remote --command "SELECT * FROM posts;"
npx wrangler d1 execute mimi-cat-db --remote --command "SELECT * FROM cat_profile;"
```

本地库命令示例：

```bash
npx wrangler d1 execute mimi-cat-db --command "SELECT * FROM posts;"
```

本地库和远程库不是同一个数据库，所以本地改数据不会自动同步到 Cloudflare。

## 部署

项目部署在 Vercel。

生产部署：

```bash
npx vercel --yes --prod
```

清理 Vercel 缓存：

```bash
npx vercel cache purge --yes
```

自定义域名：

```text
ertou.abobb.com
```

DNS 记录建议：

```text
Type: CNAME
Name: ertou
Target: cname.vercel-dns.com
TTL: Auto
```

如果需要让中国访问更稳定，可以在 Cloudflare 里开启橙云代理，但要确保 SSL/TLS 模式不是 Flexible，建议使用 Full 或 Full (strict)。

## 使用说明

1. 打开站点后，普通访客可以点赞和评论。
2. 点击右下角猫爪按钮，选择管理员登录。
3. 登录成功后，顶部会出现发帖框。
4. 发布动态时可以选择本地照片，照片会上传到 R2。
5. 鼠标移到动态卡片上，可以编辑或删除动态。
6. 点击猫咪档案区域的编辑按钮，可以修改二头资料和头像。
7. 保存档案后，数据写入 Cloudflare D1，电脑和手机刷新后都会同步。

## 常见问题

### 为什么电脑改了，手机之前还是旧内容？

旧版本把猫咪档案存在浏览器 `localStorage`，每台设备都有自己的本地数据。现在已经改为 Cloudflare D1 存储，手机和电脑都会读取同一份云端档案。

### 为什么改 D1 数据本地生效，线上没变化？

很可能操作的是本地 D1。用 wrangler 改线上数据库时必须加 `--remote`。

### 为什么 Instagram 内置浏览器还看到旧页面？

可能是内置浏览器缓存。可以关闭页面重新打开，或者临时在 URL 后加版本参数：

```text
https://ertou.abobb.com/?v=4
```

### 为什么竖版照片以前显示成横的？

旧版动态图用了固定高度和 `object-cover`，竖图会被裁切。现在动态图片会读取真实宽高，竖图完整居中显示，横图保持正常宽度。

### 为什么不直接用 Cloudflare Workers？

当前项目部署在 Vercel，Next.js API Route 通过 Cloudflare REST API 访问 D1 和 R2。这样保留 Vercel 的 Next.js 部署体验，同时使用 Cloudflare 存储。

## 项目结构

```text
cat-blog-next/
├── app/
│   ├── api/
│   │   ├── auth/route.ts      # 登录验证
│   │   ├── posts/route.ts     # 动态、点赞、评论
│   │   ├── profile/route.ts   # 猫咪档案
│   │   └── upload/route.ts    # R2 图片上传
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # 主页面
├── lib/
│   └── cloudflare.ts          # Cloudflare REST API 工具
├── public/
├── wrangler.toml              # Cloudflare D1/R2 配置
├── package.json
└── README.md
```

## 后续可以优化

- 给管理操作加更完整的登录会话保护。
- 图片上传前做压缩，减少 R2 存储和页面加载体积。
- 把普通 `<img>` 迁移到 `next/image` 或自定义图片优化方案。
- 增加动态详情页和分享用 Open Graph 图片。
- 增加数据备份脚本，定期导出 D1。
