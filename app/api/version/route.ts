/**
 * Webapp-side version endpoint. Symmetry with the Pi's /version — lets the
 * Pi (or external monitors) detect a webapp rev mismatch without scraping
 * GitHub. Public, no auth: only exposes build metadata Vercel already
 * surfaces in the deployment URL.
 */

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

export async function GET() {
  return Response.json({
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    git_short_sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    git_branch: process.env.VERCEL_GIT_COMMIT_REF ?? "main",
    git_repo: process.env.VERCEL_GIT_REPO_SLUG ?? "ocarina-webapp",
    deploy_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    deploy_url: process.env.VERCEL_URL ?? "localhost",
    region: process.env.VERCEL_REGION ?? null,
    env: process.env.VERCEL_ENV ?? "development",
    node: process.version,
    started_at: STARTED_AT,
    uptime_ms: Date.now() - STARTED_AT,
  });
}
