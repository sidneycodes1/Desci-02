import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../lib/app-session';
import { fundProjectSchema, addWei } from '../../../../../lib/validation/funding';

/**
 * GET /api/projects/[id]/fund — list funders (project members only).
 * Funding amounts are public to members; non-members get 403 (same rule as
 * treasury reads — plan §02 funders list goes public in Phase 3 with feed).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isOwner = project.owner_user_id === appUserId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', appUserId)
      .single();
    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: funders, error } = await supabase
      .from('project_funders')
      .select('*')
      .eq('project_id', id)
      .order('total_funded_wei', { ascending: false });
    if (error) {
      console.error('Error fetching funders:', error);
      return NextResponse.json({ error: 'Failed to fetch funders' }, { status: 500 });
    }
    return NextResponse.json({ funders: funders ?? [] });
  } catch (error) {
    console.error('GET /api/projects/[id]/fund error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/fund — record funding (ANY authenticated wallet).
 * Plan §02: funding never grants edit. MVP credits the cached
 * `treasury_balances` row immediately; the on-chain `deposit()` reconcile
 * stays the source of truth (see RECONCILIATION.md).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = fundProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Upsert funder total.
    const { data: existing } = await supabase
      .from('project_funders')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', appUserId)
      .single();

    let funder;
    if (existing) {
      const total = addWei(existing.total_funded_wei as string, parsed.data.amountWei);
      const { data: updated, error } = await supabase
        .from('project_funders')
        .update({ total_funded_wei: total, last_funded_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('Error updating funder:', error);
        return NextResponse.json({ error: 'Failed to record funding' }, { status: 500 });
      }
      funder = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('project_funders')
        .insert({
          id: crypto.randomUUID(),
          project_id: id,
          user_id: appUserId,
          total_funded_wei: parsed.data.amountWei,
        })
        .select()
        .single();
      if (error) {
        console.error('Error inserting funder:', error);
        return NextResponse.json({ error: 'Failed to record funding' }, { status: 500 });
      }
      funder = inserted;
    }

    // Credit the cached treasury balance (off-chain credit; chain reconciles).
    const { data: balance } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();
    const prev = (balance?.onchain_balance_wei as string | undefined) ?? '0';
    const next = addWei(prev, parsed.data.amountWei);
    if (balance) {
      await supabase
        .from('treasury_balances')
        .update({ onchain_balance_wei: next, last_synced_at: new Date().toISOString() })
        .eq('project_id', id);
    } else {
      await supabase
        .from('treasury_balances')
        .insert({ project_id: id, onchain_balance_wei: next });
    }

    return NextResponse.json({ funder, treasuryBalanceWei: next }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/fund error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
