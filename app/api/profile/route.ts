import { NextRequest, NextResponse } from 'next/server';
import { D1Row, d1Query } from '@/lib/cloudflare';

interface CatProfile {
  name: string;
  title: string;
  avatar: string;
  bio: string;
  age: string;
  weight: string;
  favoriteSnack: string;
}

const DEFAULT_PROFILE: CatProfile = {
  name: '二头 (Ertou)',
  title: '全职干饭人 / 呆傻唐氏小猫 / 木头猫',
  avatar: 'https://pub-43ab46cd14c94349a0bf225e0b768dc9.r2.dev/1783427709553-ertou-profile-from-browser.jpg',
  bio: "专注于人类驯化研究长达两年。熟练掌握'凌晨三点跑酷'、'用屁股对着镜头'以及'假装听不懂人话'等核心技术。",
  age: '7 岁',
  weight: '4.5 kg',
  favoriteSnack: '冻干高能鸡肉粒',
};

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

async function ensureProfileTable() {
  await d1Query(`
    CREATE TABLE IF NOT EXISTS cat_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      avatar TEXT NOT NULL,
      bio TEXT NOT NULL,
      age TEXT NOT NULL,
      weight TEXT NOT NULL,
      favorite_snack TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function rowToProfile(row: D1Row): CatProfile {
  return {
    name: String(row.name || DEFAULT_PROFILE.name),
    title: String(row.title || DEFAULT_PROFILE.title),
    avatar: String(row.avatar || DEFAULT_PROFILE.avatar),
    bio: String(row.bio || DEFAULT_PROFILE.bio),
    age: String(row.age || DEFAULT_PROFILE.age),
    weight: String(row.weight || DEFAULT_PROFILE.weight),
    favoriteSnack: String(row.favorite_snack || DEFAULT_PROFILE.favoriteSnack),
  };
}

function normalizeProfile(profile: Partial<CatProfile>): CatProfile {
  return {
    name: String(profile.name || DEFAULT_PROFILE.name).trim(),
    title: String(profile.title || DEFAULT_PROFILE.title).trim(),
    avatar: String(profile.avatar || DEFAULT_PROFILE.avatar).trim(),
    bio: String(profile.bio || DEFAULT_PROFILE.bio).trim(),
    age: String(profile.age || DEFAULT_PROFILE.age).trim(),
    weight: String(profile.weight || DEFAULT_PROFILE.weight).trim(),
    favoriteSnack: String(profile.favoriteSnack || DEFAULT_PROFILE.favoriteSnack).trim(),
  };
}

async function getProfile() {
  await ensureProfileTable();

  const rows = await d1Query('SELECT * FROM cat_profile WHERE id = 1');
  if (rows.length > 0) {
    return rowToProfile(rows[0]);
  }

  await saveProfile(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

async function saveProfile(profile: CatProfile) {
  await ensureProfileTable();

  await d1Query(
    `INSERT INTO cat_profile (id, name, title, avatar, bio, age, weight, favorite_snack, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       title = excluded.title,
       avatar = excluded.avatar,
       bio = excluded.bio,
       age = excluded.age,
       weight = excluded.weight,
       favorite_snack = excluded.favorite_snack,
       updated_at = CURRENT_TIMESTAMP`,
    [
      profile.name,
      profile.title,
      profile.avatar,
      profile.bio,
      profile.age,
      profile.weight,
      profile.favoriteSnack,
    ]
  );
}

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json(profile, { headers: noStoreHeaders });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500, headers: noStoreHeaders });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const profile = normalizeProfile(await request.json());
    await saveProfile(profile);
    return NextResponse.json(profile, { headers: noStoreHeaders });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500, headers: noStoreHeaders });
  }
}
