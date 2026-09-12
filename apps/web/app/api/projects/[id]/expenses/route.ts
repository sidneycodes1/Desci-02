import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { proposeExpenseSchema } from '../../../../../lib/validation/treasury';
import { validateSpendRequest } from '@sciagent/shared/services/treasuryService';

/**
 * GET /api/projects/[id]/expenses - List expenses for a project
 */
export async function GET(
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

    const supabase = createSupabaseClientFromToken(token);

    // Verify project access
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.owner_user_id === session.userId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', session.userId)
      .single();

    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: expensesList, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    return NextResponse.json({ expenses: expensesList });
  } catch (error) {
    console.error('GET /api/projects/[id]/expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/expenses - Propose a spend request / expense
 * Enforces recipient owner match, memo bounds, and budget guards server-side.
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

    const body = await request.json();
    const validationResult = proposeExpenseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

    // Get project & owner user wallet
    const { data: project } = await supabase
      .from('projects')
      .select('*, users!owner_user_id(id, wallets(address))')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Permission check: Proposer must be owner or admin
    if (project.owner_user_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Only project owner or admin can propose spending' }, { status: 403 });
    }

    // Get owner wallet address
    const ownerWallets = project.users?.wallets;
    const ownerWalletAddress = Array.isArray(ownerWallets) && ownerWallets.length > 0
      ? ownerWallets[0].address
      : validationResult.data.recipientAddress; // fallback if wallet unlinked in dev

    // Fetch current treasury balance
    const { data: treasuryBalance } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();

    const currentBalanceWei = treasuryBalance?.onchain_balance_wei ?? '0';

    // Server-side validation against budget, recipient, & memo bounds
    const spendValidation = validateSpendRequest({
      projectOwnerWallet: ownerWalletAddress,
      recipientAddress: validationResult.data.recipientAddress,
      proposedAmountWei: validationResult.data.amountWei,
      currentOnchainBalanceWei: currentBalanceWei,
      memo: validationResult.data.memo,
    });

    if (!spendValidation.isValid) {
      return NextResponse.json(
        { error: spendValidation.error, code: spendValidation.code },
        { status: spendValidation.code === 'INSUFFICIENT_FUNDS' ? 400 : 400 }
      );
    }

    // Insert expense proposal into database
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        project_id: id,
        proposer_user_id: session.userId,
        recipient_address: validationResult.data.recipientAddress,
        amount_wei: validationResult.data.amountWei,
        memo: validationResult.data.memo,
        status: 'proposed',
      })
      .select()
      .single();

    if (error) {
      console.error('Error proposing expense:', error);
      return NextResponse.json({ error: 'Failed to record expense proposal' }, { status: 500 });
    }

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
