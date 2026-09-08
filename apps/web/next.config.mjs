
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sciagent/shared'],
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  webpack(config) {
    config.cache = false;
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      /Critical dependency: the request of a dependency is an expression/
    ];
    return config;
  }
};

// Sentry disabled for local Windows build due to opentelemetry worker crash (3221225794).
// Re-enable via `withSentryConfig` when SENTRY_AUTH_TOKEN is real (CI/Linux).
// Original config preserved below for reference:
// import { withSentryConfig } from '@sentry/nextjs';
// const sentryWebpackPluginOptions = { silent:true, sourcemaps:{disable:true}, org:process.env.SENTRY_ORG, project:process.env.SENTRY_PROJECT, authToken:process.env.SENTRY_AUTH_TOKEN };
// export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);

export default nextConfig;
