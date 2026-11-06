# Rohan's 3-Month Startup Plan

A one-page site with the plan and a shared goal tracker. When anyone clicks a status or adds a goal, everyone with the link sees the change.

## What's inside

- `index.html`: the whole site (plan, timeline, milestones, tracker)
- `api/tracker.js`: a small API that saves tracker clicks
- `package.json`: tells Vercel how to run the API

## Deploy to Vercel (about 10 minutes)

1. **Upload the folder.** Put this folder in a GitHub repo, then in Vercel choose **Add New > Project** and import the repo. You can also install the Vercel CLI and run `vercel` from inside this folder. No build settings are needed.
2. **Add storage so the tracker is shared.** In your Vercel project, open **Storage**, choose **Upstash for Redis** from the Marketplace (the free plan is enough) and connect it to this project. This adds the environment variables the API needs (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
3. **Redeploy** so the new variables take effect (Deployments > the latest one > Redeploy).
4. Open the site. The tracker should say **Synced**. If it says **Saved in this browser only**, storage isn't connected yet.

## Optional settings

Add these under **Settings > Environment Variables**, then redeploy:

| Variable | What it does |
| --- | --- |
| `EDIT_PIN` | Anyone can view, but changing the tracker asks for this PIN once per browser. Recommended, so a stray click from someone else can't change progress. |
| `TRACKER_PREFIX` | Keeps each student's tracker separate if you reuse this site. Default is `rohan`. |

## Editing the plan

All plan text lives near the top of the `<script>` in `index.html` (`PRINCIPLES`, `MONTHS`, `CHECKPOINTS`, `WORK`, `DISCLAIMER`). Edit the text and redeploy. Keep each task's short id (like `p1`) the same, or its saved status will reset.

## Previewing without Vercel

Opening `index.html` directly works too. The tracker runs in local mode and saves only in that browser.
