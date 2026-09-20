import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../lib/app-session';
import { createArticleSchema, slugify } from '../../../lib/validation/article';

/**
 * GET /api/articles — public feed of published articles (auth required for
 * session bridging, but no membership gate: reading is universal).
 * Optional ?authorHandle= filter to show articles by a specific user.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { supabase } = ctx.session;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const authorHandle = searchParams.get('authorHandle');

    let query = supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .is('deleted_at', null);

    if (authorHandle) {
      // Fetch user by handle first to get their id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('handle', authorHandle)
        .single();

      if (userError || !user) {
        // If user not found, return empty results
        return NextResponse.json({ articles: [] });
      }

      query = query.eq('author_id', user.id);
    }

    if (projectId) query = query.eq('project_id', projectId);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching articles:', error);
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
    }
    return NextResponse.json({ articles: data ?? [] });
  } catch (error) {
    console.error('GET /api/articles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/articles — create (ANY authenticated wallet; becomes author).
 * Plan §02: writing your OWN article needs no invite.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = createArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', parsed.data.projectId)
        .is('deleted_at', null)
        .single();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        id: crypto.randomUUID(),
        author_id: appUserId,
        project_id: parsed.data.projectId ?? null,
        slug: slugify(parsed.data.title),
        title: parsed.data.title,
        subtitle: parsed.data.subtitle ?? null,
        body: parsed.data.body,
        status: parsed.data.status,
        visibility: 'public',
        published_at: parsed.data.status === 'published' ? now : null,
      })
      .select()
      .single();
    if (error || !article) {
      console.error('Error creating article:', error);
      return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
    }
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error('POST /api/articles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
