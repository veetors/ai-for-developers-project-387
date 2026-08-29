// Lighthouse CI config for the scheduled audit.
//
// The audit targets the production stack started by the workflow
// (docker compose --profile default): nginx on :3000 proxying /api to Django.
// LHCI only collects/asserts/upload — the server is already running.
//
// URLs with a dynamic port are normalized by LHCI (default urlReplacementPatterns).

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/event-types',
        'http://localhost:3000/event-types/1',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      // Warning-only thresholds for now: the job must stay green and surface a
      // clear signal. Tighten to "error" once the lookback in
      // docs/devlog/0013-lighthouse-ci.md stabilizes.
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.95 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.2 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
      githubToken: process.env.LHCI_GITHUB_TOKEN,
    },
  },
}