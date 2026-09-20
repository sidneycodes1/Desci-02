import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../../lib/app-session';
import { reconcileProjectTreasuryState } from '@sciagent/shared/services/treasuryService';

/**
 * POST /api/projects/[id]/treasury/reconcile - Reconcile database treasury state with on-chain balance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json().catch(() => ({}));
    const onchainBalanceWei = typeof body.onchainBalanceWei === 'string' ? body.onchainBalanceWei : '0';
    const onchainBlockNumber = typeof body.onchainBlockNumber === 'number' ? body.onchainBlockNumber : 1;

    const supabase = session.supabase;

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    if (project.owner_user_id !== session.appUserId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch existing cached balance
    const { data: existingBalance } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();

    const prevBalance = existingBalance?.onchain_balance_wei ?? '0';

    const reconciliation = reconcileProjectTreasuryState(prevBalance, {
      projectId: id,
      onchainBalanceWei,
      onchainBlockNumber,
    });

    // Upsert updated balance
    const { data: updated, error } = await supabase
      .from('treasury_balances')
      .upsert({
        project_id: id,
        onchain_balance_wei: reconciliation.newBalanceWei,
        last_synced_at: reconciliation.syncedAt,
        last_synced_block: reconciliation.syncedBlock,
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating treasury balance:', error);
      return NextResponse.json({ error: 'Failed to reconcile treasury state' }, { status: 500 });
    }

    return NextResponse.json({
      reconciliation,
      balance: updated,
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/treasury/reconcile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}