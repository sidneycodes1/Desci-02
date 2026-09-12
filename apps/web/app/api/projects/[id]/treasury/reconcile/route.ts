import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const body = await request.json().catch(() => ({}));
    const onchainBalanceWei = typeof body.onchainBalanceWei === 'string' ? body.onchainBalanceWei : '0';
    const onchainBlockNumber = typeof body.onchainBlockNumber === 'number' ? body.onchainBlockNumber : 1;

    const supabase = createSupabaseClientFromToken(token);

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

    if (project.owner_user_id !== session.userId && session.role !== 'admin') {
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
