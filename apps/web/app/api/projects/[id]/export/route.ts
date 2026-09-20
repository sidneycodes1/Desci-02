import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../lib/app-session';
import { exportReportQuerySchema } from '../../../../../lib/validation/report';
import {
  exportResearchLogsToCSV,
  exportExpensesToCSV,
  exportMilestonesToCSV,
  sumCommittedExpensesWei,
} from '@sciagent/shared/services/reportService';

/**
 * GET /api/projects/[id]/export?format=csv|json&section=all|logs|expenses|milestones
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

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
    const supabase = session.supabase;

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

    const isOwner = project.owner_user_id === session.appUserId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', session.appUserId)
      .single();

    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    if (!isOwner && !collaborator && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch related datasets. Sections are fetched independently so one
    // section's failure can't silently empty another's. NOTE: `expenses` has
    // NO `deleted_at` column by design (financial audit trail — rows are
    // never soft-deleted), so it must not be filtered on it; doing so makes
    // PostgREST reject the query and would empty the ledger silently.
    const wantLogs = section === 'all' || section === 'logs';
    const wantExpenses = section === 'all' || section === 'expenses';
    const wantMilestones = section === 'all' || section === 'milestones';

    const [logsRes, expensesRes, milestonesRes, treasuryRes] = await Promise.all([
      wantLogs
        ? supabase.from('research_logs').select('*').eq('project_id', id).is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
      wantExpenses
        ? supabase.from('expenses').select('*').eq('project_id', id)
        : Promise.resolve({ data: [], error: null }),
      wantMilestones
        ? supabase.from('milestones').select('*').eq('project_id', id).is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
      wantExpenses
        ? supabase.from('treasury_balances').select('*').eq('project_id', id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // A failed dataset fetch is a 500 with a named section — never an empty
    // section masquerading as "no data" in a funder-facing audit export.
    if (logsRes.error) {
      console.error(`GET /api/projects/${id}/export: logs fetch failed:`, logsRes.error);
      return NextResponse.json({ error: 'Failed to export research logs' }, { status: 500 });
    }
    if (expensesRes.error) {
      console.error(`GET /api/projects/${id}/export: expenses fetch failed:`, expensesRes.error);
      return NextResponse.json({ error: 'Failed to export expenses ledger' }, { status: 500 });
    }
    if (milestonesRes.error) {
      console.error(`GET /api/projects/${id}/export: milestones fetch failed:`, milestonesRes.error);
      return NextResponse.json({ error: 'Failed to export milestones' }, { status: 500 });
    }
    if (treasuryRes.error) {
      console.error(
        `GET /api/projects/${id}/export: treasury balance fetch failed:`,
        treasuryRes.error
      );
      return NextResponse.json({ error: 'Failed to export treasury balance' }, { status: 500 });
    }

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
      createdAt: m.created_at,
    }));

    if (format === 'csv') {
      let csvContent = '';
      if (section === 'logs') {
        csvContent = exportResearchLogsToCSV(logs);
      } else if (section === 'expenses') {
        csvContent = exportExpensesToCSV(expenses);
      } else if (section === 'milestones') {
        csvContent = exportMilestonesToCSV(milestones);
      } else {
        csvContent = [
          '=== RESEARCH LOGS ===',
          exportResearchLogsToCSV(logs),
          '\n=== EXPENSES LEDGER ===',
          exportExpensesToCSV(expenses),
          '\n=== MILESTONES ===',
          exportMilestonesToCSV(milestones),
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

    // Default JSON report export. Datasets outside the requested section are
    // omitted (not emptied): `section=logs` returns no `expenses` key at all,
    // so callers can distinguish "not requested" from "requested but empty".
    // totalExpensesWei = committed spend (approved + executed); proposed and
    // failed expenses are listed but excluded from the total.
    const report: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        metadataUri: project.metadata_uri,
        status: project.status,
        ownerUserId: project.owner_user_id,
        createdAt: project.created_at,
      },
    };
    if (wantExpenses) {
      report.treasury = {
        onchainBalanceWei: treasuryRes.data?.onchain_balance_wei ?? '0',
        totalExpensesWei: sumCommittedExpensesWei(expenses),
        expenseCount: expenses.length,
      };
      report.expenses = expenses;
    }
    if (wantMilestones) {
      report.milestones = milestones;
    }
    if (wantLogs) {
      report.logs = logs;
    }
    return NextResponse.json({ report });
  } catch (error) {
    console.error('GET /api/projects/[id]/export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}