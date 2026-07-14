import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sciagent/shared'],
  webpack(config) {
    config.cache = false;
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      /Critical dependency: the request of a dependency is an expression/
    ];
    return config;
  }
};

const sentryWebpackPluginOptions = {
  silent: true,
  sourcemaps: {
    disable: true
  },
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
