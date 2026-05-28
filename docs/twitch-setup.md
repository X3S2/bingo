# StreamBingo — Twitch Setup Guide

This guide walks you through setting up your Twitch Developer Application and bot account for StreamBingo.

---

## 1. Create a Twitch Developer Application

1. Visit [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Log in with your Twitch account
3. Click **Register Your Application**
4. Fill in the form:

| Field | Value |
|---|---|
| **Name** | StreamBingo (or any name) |
| **OAuth Redirect URLs** | `https://yourdomain.com/api/auth/callback/twitch` |
| **Category** | Website Integration |

5. Click **Create**
6. Click **Manage** on your new application
7. Copy **Client ID**
8. Click **New Secret** → Copy **Client Secret**

> ⚠️ Never share your Client Secret publicly.

---

## 2. Set Up a Bot Twitch Account (Optional)

StreamBingo uses a separate bot account for Twitch IRC (chat commands). You can use your main account, but a dedicated bot account is recommended.

1. Create a new Twitch account (e.g. `StreamBingoBot`)
2. Log into that account and visit [twitchapps.com/tmi](https://twitchapps.com/tmi/)
3. Click **Connect** and authorize
4. Copy the token (starts with `oauth:`)

> This token goes into the Setup Wizard as **Bot Access Token**.

---

## 3. Configure EventSub (Channel Point Redeems)

StreamBingo uses Twitch EventSub webhooks to receive channel point redeem notifications.

### Requirements

- Your domain must be **publicly accessible over HTTPS**
- Twitch will verify your webhook endpoint

### How it works

1. When a channel point redeem happens, Twitch sends a signed POST request to:
   `https://yourdomain.com/api/eventsub`
2. StreamBingo verifies the HMAC signature using `TWITCH_EVENTSUB_SECRET`
3. If valid, the user receives a bingo card (or gifts one to another user)

### Manual EventSub Registration (if not using the setup wizard)

You can register EventSub subscriptions via the Twitch CLI:

```bash
twitch event trigger subscribe \
  --type channel.channel_points_custom_reward_redemption.add \
  --to-user YOUR_STREAMER_TWITCH_ID \
  --secret YOUR_EVENTSUB_SECRET \
  --callback https://yourdomain.com/api/eventsub
```

---

## 4. Required OAuth Scopes

StreamBingo requests these OAuth scopes from users:

| Scope | Purpose |
|---|---|
| `user:read:email` | Display name and basic profile |
| (none required for viewers) | Viewers only need basic auth |

For the **bot account** (TMI token):
- Full chat access is granted with the TMI token from twitchapps.com/tmi

---

## 5. Chat Commands

Once the bot is connected to a channel, viewers can use these commands in chat:

| Command | Effect |
|---|---|
| `!bingo` | Claim bingo (if a game is running and user has a card) |

Streamers and moderators can also draw numbers from the moderator dashboard instead of using chat commands.

---

## 6. Channel Points Setup (Optional)

StreamBingo supports two redeem types:

| Type | Description |
|---|---|
| **Self Redeem** | Viewer redeems to get their own bingo card |
| **Gift Redeem** | Viewer redeems to gift a bingo card to another viewer |

### Setting Up Channel Point Redeems

1. Go to your Twitch dashboard → **Viewer Rewards** → **Channel Points**
2. Create a new custom reward:
   - **Name**: e.g. "Bingo-Karte" (Self) or "Bingo-Karte verschenken" (Gift)
   - **Cost**: Your choice (e.g. 100 points)
   - Enable **"Require Viewer to Enter Text"** for Gift redeems (they type the recipient's username)
3. Note the reward ID from the Twitch API or EventSub notification
4. Configure the reward IDs in StreamBingo's admin settings

---

## 7. Twitch Account Roles in StreamBingo

| StreamBingo Role | Who gets it |
|---|---|
| **VIEWER** | Default for all authenticated users |
| **MODERATOR** | Manually assigned by Admin, or auto-promoted if Twitch mod |
| **STREAMER** | Manually assigned by Admin — can create/manage games |
| **ADMIN** | The first user to complete the setup wizard |

Role assignment is managed in the **Admin Portal** → **Users** tab.

---

## 8. Troubleshooting

### OAuth Redirect Mismatch

**Error**: `redirect_uri does not match the registered URI`  
**Fix**: Ensure the `TWITCH_REDIRECT_URI` in your `.env` exactly matches what you entered in the Twitch dev console (including https/http and trailing slashes).

### Bot Not Joining Channel

**Check**: The bot account's OAuth token must start with `oauth:` (from twitchapps.com/tmi).  
**Check**: The channel name in your game creation must exactly match the Twitch channel name (lowercase).

### EventSub Verification Failing

**Check**: `TWITCH_EVENTSUB_SECRET` must be between 10–100 characters.  
**Check**: Your domain must be publicly accessible via HTTPS.  
**Check**: Nginx must not buffer the request body (raw body is needed for HMAC verification — already configured).
