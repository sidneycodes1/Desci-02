import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { exportReportQuerySchema } from '../../../../../lib/validation/report';
import {
  exportResearchLogsToCSV,
  exportExpensesToCSV,
} from '@sciagent/shared/services/reportService';

/**
 * GET /api/projects/[id]/export?format=csv|json&section=all|logs|expenses|milestones
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const { searchParams } = new URL(request.url);
    const queryResult = exportReportQuerySchema.safeParse({
      format: searchParams.get('format') ?? undefined,
      section: searchParams.get('section') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { format, section } = queryResult.data;
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

    if (!isOwner && !collaborator && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch related datasets
    const [logsRes, expensesRes, milestonesRes, treasuryRes] = await Promise.all([
      supabase.from('research_logs').select('*').eq('project_id', id).is('deleted_at', null),
      supabase.from('expenses').select('*').eq('project_id', id).is('deleted_at', null),
      supabase.from('milestones').select('*').eq('project_id', id).is('deleted_at', null),
      supabase.from('treasury_balances').select('*').eq('project_id', id).maybeSingle(),
    ]);

    const logs = (logsRes.data ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      content: l.content,
      createdAt: l.created_at,
    }));

    const expenses = (expensesRes.data ?? []).map((e) => ({
      id: e.id,
      recipientAddress: e.recipient_address,
      amountWei: e.amount_wei,
      memo: e.memo ?? '',
      status: e.status,
      createdAt: e.created_at,
    }));

    const milestones = (milestonesRes.data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      state: m.state,
      proofUri: m.proof_uri,
    }));

    if (format === 'csv') {
      let csvContent = '';
      if (section === 'logs') {
        csvContent = exportResearchLogsToCSV(logs);
      } else if (section === 'expenses') {
        csvContent = exportExpensesToCSV(expenses);
      } else {
        csvContent = [
          '=== RESEARCH LOGS ===',
          exportResearchLogsToCSV(logs),
          '\n=== EXPENSES LEDGER ===',
          exportExpensesToCSV(expenses),
        ].join('\n');
      }

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="project_${id}_export.csv"`,
        },
      });
    }

    // Default JSON report export
    return NextResponse.json({
      report: {
        exportedAt: new Date().toISOString(),
        project: {
          id: project.id,
          name: project.name,
          metadataUri: project.metadata_uri,
          status: project.status,
          ownerUserId: project.owner_user_id,
          createdAt: project.created_at,
        },
        treasury: {
          onchainBalanceWei: treasuryRes.data?.onchain_balance_wei ?? '0',
          totalExpensesWei: treasuryRes.data?.total_expenses_wei ?? '0',
          expenseCount: expenses.length,
        },
        milestones,
        logs,
        expenses,
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
