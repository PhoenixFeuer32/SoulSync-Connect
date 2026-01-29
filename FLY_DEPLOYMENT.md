# Fly.io Deployment Guide for SoulSync Connect

## Prerequisites

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Add Fly CLI to your PATH (follow the instructions after installation)

3. Login to Fly.io:
```bash
flyctl auth login
```

## Initial Setup

### 1. Create Your Fly.io App

If you don't already have a Fly.io app, create one:

```bash
flyctl launch --no-deploy
```

This will detect your app and use the existing `fly.toml` configuration. Choose "yes" when asked if you want to tweak the settings.

**Important:** When asked about database, say "no" - you'll be using your existing PostgreSQL database.

### 2. Set Environment Variables

You need to set all your environment variables as secrets in Fly.io:

```bash
# Database
flyctl secrets set DATABASE_URL="postgresql://souldb_lygb_user:EKOMWXtpGQICNwACpSoaX3Q2i1umtMGc@dpg-d2rptore5dus73c6t8kg-a.oregon-postgres.render.com/souldb_lygb"

# Encryption & Session
flyctl secrets set ENCRYPTION_KEY="7b4b2a5a03132eec7286f16f9a108d48"
flyctl secrets set SESSION_SECRET="384a82ef80d54a6d1aef6819ad9a67fcc858f470b9632cd34fdf32e34061dc6a"

# Twilio
flyctl secrets set TWILIO_ACCOUNT_SID="AC16c516586038b347bf461cb2d41761ce"
flyctl secrets set TWILIO_AUTH_TOKEN="3ddb02c16ebf69d39abc969d1f7ed85a"
flyctl secrets set TWILIO_PHONE_NUMBER="+14057774604"

# Kindroid API
flyctl secrets set KINDROID_API_KEY="kn_7ba470f2-bef9-4ca7-9ec3-c4c6e7f863fd"
flyctl secrets set KINDROID_API_URL="https://api.kindroid.ai/v1"

# ElevenLabs
flyctl secrets set ELEVENLABS_API_KEY="sk_0c7a9dfc0af7213177be1818885c766230cecdd22efc39e0"

# AWS
flyctl secrets set AWS_REGION="us-east-1"
flyctl secrets set AWS_ACCESS_KEY_ID="AKIAVV45UHD6BNYL65OC"
flyctl secrets set AWS_SECRET_ACCESS_KEY="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"

# Google Cloud (Base64 encoded credentials)
flyctl secrets set GOOGLE_CLOUD_CREDENTIALS_BASE64="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYXRsYW50ZWFuLWZpZWxkLTQ3NDcwMy1rMCIsCiAgInByaXZhdGVfa2V5X2lkIjogIjI1ZmY4MTExMTQ0ZTQwNDA2NmI0NWQzODdhM2Q5NjRlZmVkZWI3ZmMiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ2ZQaUpicm55c05CRW9cbnBlcUV6T1M3elFQbXZOdkJid1RTUm5XbXV1UlkyMXN4amlNWnFWMHF4MEtUSmZMNnBpclJwSGRrU1dlTDNVaWxcbmw0THhpU1FoUVBkNlk1QXJPRzdOTWdPY3BORFlBeTVUNUNjR2twdHVMZW5USUNXenVWd2Y4TGJIbmwvWEt3ckNcbmpudkJMNlFZeE9RU3lBZDZ0SmJHdnAxaU5nZllkTUhUazlPanp4VXFGQjEzZTZMaitMS1BUWnRPMDRJQmQ4OTJcblhVS09IQUdTVEJhdVp3elFqL1o0b29xUFNFeWkrdW9HL251K3A2blpEZEcwUjFQL3kwK3pqS3VxZ2FkQkhRYzRcbkwwS3pDdTFERWlCcTBRKzQ5RENCRDZCcFAvTEVmQS9GRERNeFhGdGpjQS9sdTA4VXZIcjR5dWgraXhLRlhEaEJcbkk3Z0JwS050QWdNQkFBRUNnZ0VBR2VVbmZxdXk4K2phb25iS21uSmNQc3JodDhlZDM4aC9LdmVRd2I1eURCNE5cbnFCTVNVNlcyTkJMbm1WaXFPTWJGUDBha3NKNzhNdU1XNFhDd056bGpNZkluM0ZQcytZNUpmRjVGOXBiWnJFcm1cbklYZkFQZUlnMnV1bDhySnZWeGpOS1plQ0RaZU1ROGZvemNjUVNsUEdOazNzUGI2ZjhyMERxTW1OKzg3SCsxT05cbmZ5Qi9VK1FscTY0VVJBY2JvL2NUa0xaeEduaWN0aitRTiswN2E0bmtZSE5wZnU4ZjgyR1lZT3BKYjhhTUNRSXBcbkllZXZpY1I5eVhvTS94dkZSQm5hWGNnQmF2UWtXRzg2eFl5SjNvVlE0NklSeDE4ZndDcHpJSEoyQklQY0tJZ0dcbnpkNGlSTmN4VHR3b2FHS2dJQkU4VVlEeXlicDFYK3JDY3NLamk3QmsrUUtCZ1FEVklvZjF6R0VGNXk3c2tHQUpcbjUwSTE0dzhRZFVGU2JRa0xWSVYvTGQ5MzhJWU9BaitMRGN3RXJqMVRxL2RLRkEvRnhkamdva0kyYVFJQmhsWkdcbkFBQkxnZk1RUmJYeDY3bW0wUHMzMjV4Wmt4OTNXRTMrcWloVlBIOSt0NitOaU85eHNIbTBjbk5QNEFmL0VsSEpcbmtOaVYrK1FkRUlBck1QVmp4SzhuK0l0MU9RS0JnUUMvUk9pMmJuQ1pMdWRVaVNDNzdpVVAyQVJMbmJ3cnA5djJcbkdrRFkvcGhEdnZuMmh6VHhpWTdNSG4xWTVvWVBNcmJrWVdsb09SNXk3WkVkRDc4ZUc4WmVldkNaM1FVN1lFU2JcblFTRFR6VEErZVNtYTVTeWVESitqY2V6SnkybnU3a2ZYdldPR1BDYmRzUXd3c0YxTTdibVlpL0tLUG5zT1lSQktcbmRiY2Nydy96MVFLQmdRQ2IxZW12RU1hSCtHYlkxUjlEWG5HTTBQMzh2SjhNVTJqZmZlYzEvQ1orbmNDR2thSkFcblc5QW1RL2ZYSzg5ZHZKbGpzNnRGWTU0aUJsbFBJQmdJaW91c3FkRTh2cHV2elBrclBYWFJlNk12NDJDSWRHcGlcbm42dHAxeGdwWU1qZEpaaGRlZmtpdE9RWExPanIyVXN2bzlhWW8xcEEzZ1c0anMxOUt4d2VqNTM0RVFLQmdHSW9cbldna3Rta2x5d2JNbmdJNFJoQ0dpYVdubzlDV3ZTbm45TlNSblcvc0Fha1Z6VTk5VkNkeUZGU3puZVFzWnFyUi9cbnJWbVlYcUQ2ZkV0ZXhtVU1PZnhJdVdzcyt6OWlnekx0OUl2ZHRKR0xHcWZzVHI1NW1mK0dPcy9BdlllcDcyS3ZcblJnRWdvNDJJQzhwODZCVFB0enlyTFhoMjRpNFo4QU5XYi9lZmU5OVZBb0dBWlVKUm5lRVkwTVBRVDU3TitGd2tcbm40MkVURHh0eWQ0ZzdIWElOdldHUFlTSUp5RUhvUlFVTVF5WGRUNnUxQjA2QUtTWUJLMm4wQStTOVJ6SnY1YzdcbkJJc0RtQXpCRVYxZmVLWWhhaTAvcDU1RHoybnY4VXloODhDSk44cEgvRDkrMG1QQ1FyT2hRT3Btb051VUVxaXlcblVEQlArTXJQbGhnd1MvSXRsa2RkaERjPVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogInNvdWxzeW5jLXR0c0BhdGxhbnRlYW4tZmllbGQtNDc0NzAzLWswLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjExMTExNjk1OTEwMDAxNTk2MjcyOCIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvc291bHN5bmMtdHRzJTQwYXRsYW50ZWFuLWZpZWxkLTQ3NDcwMy1rMC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSIKfQo="

# Spotify
flyctl secrets set SPOTIFY_CLIENT_ID="8a55bc6ad0d443708f04272ef2e2a219"
flyctl secrets set SPOTIFY_CLIENT_SECRET="d7dd1cff2a0a4fdeba439d9c2f63abee"
```

**Note:** You can also set all secrets at once using a file:
```bash
flyctl secrets import < .env
```

### 3. Deploy Your Application

```bash
flyctl deploy
```

This will:
- Build your Docker image
- Push it to Fly.io's registry
- Deploy it to your app
- Start your application

### 4. Verify Deployment

Check the status of your app:
```bash
flyctl status
```

View logs:
```bash
flyctl logs
```

Open your app in the browser:
```bash
flyctl open
```

## Database Connection

Your existing PostgreSQL database on Render will continue to work. The `DATABASE_URL` you set as a secret points to your Render database.

**Important:** Make sure your Render database allows connections from external IPs. Fly.io machines will connect from different IP addresses.

## Scaling and Cost Optimization

Fly.io offers great cost savings:

### Free Tier Includes:
- Up to 3 shared-cpu-1x 256MB VMs
- 3GB persistent volume storage
- 160GB outbound data transfer

### Cost-Saving Configuration:

The `fly.toml` is configured to:
- **Auto-stop machines** when not in use (saves money!)
- **Auto-start machines** when traffic arrives
- **Minimum 0 machines** running when idle

This means your app will scale to zero when not in use, costing you nothing during idle periods.

### Scaling Up (if needed):

Scale to more machines:
```bash
flyctl scale count 2
```

Change VM size:
```bash
flyctl scale vm shared-cpu-2x --memory 2048
```

View current scaling:
```bash
flyctl scale show
```

## Persistent Storage (Optional)

If you need persistent file storage for uploads, create a volume:

```bash
flyctl volumes create data --size 1
```

Then update `fly.toml` to mount it:
```toml
[mounts]
  source = "data"
  destination = "/app/uploads"
```

## Custom Domain (Optional)

Add a custom domain:

```bash
flyctl certs create your-domain.com
flyctl certs create www.your-domain.com
```

Then add DNS records as instructed by Fly.io.

## Monitoring

View metrics:
```bash
flyctl dashboard
```

View real-time logs:
```bash
flyctl logs -f
```

## Troubleshooting

### Check if secrets are set:
```bash
flyctl secrets list
```

### SSH into your machine:
```bash
flyctl ssh console
```

### Restart your app:
```bash
flyctl apps restart
```

### View machine details:
```bash
flyctl machine list
```

## Cost Comparison: Render vs Fly.io

**Render Starter:**
- $7/month minimum
- 512MB RAM
- Always running

**Fly.io:**
- Free tier with 3GB RAM
- Auto-stop when idle = $0 when not in use
- Pay only for what you use

With Fly.io's auto-stop feature, if your app isn't heavily trafficked, you could run it for free or just a few dollars per month.

## Migration Checklist

- [ ] Install Fly CLI
- [ ] Login to Fly.io (`flyctl auth login`)
- [ ] Create app (`flyctl launch --no-deploy`)
- [ ] Set all environment variables as secrets
- [ ] Deploy (`flyctl deploy`)
- [ ] Test the application
- [ ] Update DNS if using custom domain
- [ ] Monitor for 24-48 hours
- [ ] Delete Render service (if everything works)

## Support

If you run into issues:
- Fly.io Community: https://community.fly.io/
- Fly.io Docs: https://fly.io/docs/
- Check logs: `flyctl logs`
