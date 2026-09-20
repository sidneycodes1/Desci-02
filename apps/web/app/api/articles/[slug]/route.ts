import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../lib/app-session';
import { updateArticleSchema } from '../../../../lib/validation/article';

/* eslint-disable @typescript-eslint/no-explicit-any -- supabase client shape differs between prod + test shim */
async function loadArticle(supabase: any, slug: string) {
  const { data } = await supabase.from('articles').select('*').eq('slug', slug).single();
  return data as Record<string, any> | null;
}

async function isArticleCollaborator(
  supabase: any,
  articleId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('article_collaborators')
    .select('*')
    .eq('article_id', articleId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

/**
 * GET /api/articles/[slug] — public read of published (plus author/
 * collaborator draft preview). Deleted never served.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const article = await loadArticle(supabase, slug);
    if (!article || article.deleted_at) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    const isAuthor = article.author_id === appUserId;
    const isCollab = await isArticleCollaborator(supabase, article.id as string, appUserId);
    if (article.status !== 'published' && !isAuthor && !isCollab) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    return NextResponse.json({
      article,
      canEdit: isAuthor || isCollab,
    });
  } catch (error) {
    console.error('GET /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/articles/[slug] — author + invited collaborators only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = updateArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const article = await loadArticle(supabase, slug);
    if (!article || article.deleted_at) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    const isAuthor = article.author_id === appUserId;
    const isCollab = await isArticleCollaborator(supabase, article.id as string, appUserId);
    if (!isAuthor && !isCollab) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (parsed.data.status === 'published' && !isAuthor) {
      return NextResponse.json({ error: 'Only the author can publish' }, { status: 403 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.subtitle !== undefined) patch.subtitle = parsed.data.subtitle;
    if (parsed.data.body !== undefined) patch.body = parsed.data.body;
    if (parsed.data.projectId !== undefined) patch.project_id = parsed.data.projectId;
    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status;
      if (parsed.data.status === 'published' && !article.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from('articles')
      .update(patch)
      .eq('id', article.id)
      .select()
      .single();
    if (error) {
      console.error('Error updating article:', error);
      return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
    }
    return NextResponse.json({ article: updated });
  } catch (error) {
    console.error('PATCH /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/articles/[slug] — soft-delete, author only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const article = await loadArticle(supabase, slug);
    if (!article || article.deleted_at) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    if (article.author_id !== appUserId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    await supabase
      .from('articles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', article.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
