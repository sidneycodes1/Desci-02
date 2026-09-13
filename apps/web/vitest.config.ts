import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist', 'app/api/**'],
  },
  resolve: {
    alias: {
      // NOTE: more-specific aliases must come FIRST — Vite matches string
      // aliases by prefix, so '@sciagent/shared' would otherwise swallow
      // submodule imports like '@sciagent/shared/services/...'.
      '@sciagent/shared/services/notificationService': path.resolve(
        __dirname,
        '../../packages/shared/services/notificationService.ts'
      ),
      '@sciagent/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@sciagent/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@sciagent/auth': path.resolve(__dirname, '../../packages/auth/src/index.ts'),
      '@sciagent/shared/supabase': path.resolve(
        __dirname,
        '../../packages/shared/supabase/index.ts'
      ),
      '@sciagent/shared/supabase/server': path.resolve(
        __dirname,
        '../../packages/shared/supabase/server.ts'
      ),
      '@sciagent/shared/env': path.resolve(__dirname, '../../packages/shared/env/index.ts'),
      '@sciagent/shared/env/server': path.resolve(__dirname, '../../packages/shared/env/server.ts'),
    },
  },
});
