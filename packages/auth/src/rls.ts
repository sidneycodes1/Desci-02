export function generateUserRlsPolicy(
  tableName: string,
  userIdColumn: string = 'user_id'
): string {
  return `
CREATE POLICY "SciAgent ${tableName} access" ON ${tableName}
  USING (
    ${userIdColumn} = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_registries pr
      WHERE pr.owner_id = auth.uid()
      AND pr.project_id = ${tableName}.project_id
    )
    OR EXISTS (
      SELECT 1 FROM roles r
      WHERE r.user_id = auth.uid()
      AND r.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    ${userIdColumn} = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_registries pr
      WHERE pr.owner_id = auth.uid()
      AND pr.project_id = ${tableName}.project_id
    )
    OR EXISTS (
      SELECT 1 FROM roles r
      WHERE r.user_id = auth.uid()
      AND r.role IN ('admin', 'owner')
    )
  );
`;
}

export function generateRlsPolicies(tables: string[]): string {
  return tables
    .map((table) => generateUserRlsPolicy(table))
    .join('\n');
}

export const RLS_SQL = `
-- Enable RLS on all tables
ALTER TABLE project_registries ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own projects
CREATE POLICY "Owner read own projects" ON project_registries
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Owner update own projects" ON project_registries
  FOR UPDATE USING (owner_id = auth.uid());

-- Admin can read all projects
CREATE POLICY "Admin read all projects" ON project_registries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- Expenses: proposer, project owner, or admin can read
CREATE POLICY "Expense read access" ON grant_expenses
  FOR SELECT USING (
    proposer_id = auth.uid()
    OR project_id IN (SELECT project_id FROM project_registries WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- Expenses: only project owner or admin can execute
CREATE POLICY "Expense execute access" ON grant_expenses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM project_registries pr WHERE pr.project_id = grant_expenses.project_id AND pr.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM project_registries pr WHERE pr.project_id = grant_expenses.project_id AND pr.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- Milestones: creator, project owner, or admin
CREATE POLICY "Milestone read access" ON milestones
  FOR SELECT USING (
    creator_id = auth.uid()
    OR project_id IN (SELECT project_id FROM project_registries WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- Reputation: creator, project owner, or admin
CREATE POLICY "Reputation read access" ON reputation_events
  FOR SELECT USING (
    creator_id = auth.uid()
    OR project_id IN (SELECT project_id FROM project_registries WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- Auth.uid() mapping via Privy JWT sub claim
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.sid', true)
  );
$$ LANGUAGE SQL IMMUTABLE;
`;
