# Slack Integration

Get real-time EDI alerts in Slack for exceptions and document processing.

## Setup

### 1. Create a Slack Incoming Webhook

1. Go to [Slack API](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g. "EDI Platform") and select your workspace
3. Go to **Incoming Webhooks** → turn **On**
4. Click **Add New Webhook to Workspace** and choose the channel (e.g. `#edi-alerts`)
5. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

### 2. Configure in the App

**Option A: Settings UI (recommended)**

1. Open **Settings** → **Notifications** tab
2. Paste the webhook URL in **Slack Webhook URL**
3. Enable **Exception Alerts** and **Real-Time Alerts** (document status)
4. Click **Save Changes**

**Option B: Environment variable**

Add to `backend/.env`:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxx
```

## What You'll Receive

| Event | Slack message |
|-------|---------------|
| **Exception created** | Parsing errors, validation errors, low-confidence documents |
| **Document completed** | Successful processing |
| **Document failed** | Processing failures |
| **Rule-based notify** | When exception rules with "notify" action match |

## Disable

- Remove the webhook URL in Settings, or
- Set `SLACK_WEBHOOK_URL=` (empty) in `.env`
