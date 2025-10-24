# AWS Transcribe Migration Guide

This document describes the migration from Deepgram to AWS Transcribe for speech-to-text functionality in SoulSync Connect.

## What Changed

### 1. Dependencies
- **Removed**: `@deepgram/sdk`
- **Added**: `@aws-sdk/client-transcribe-streaming`

### 2. Environment Variables

#### Before (Deepgram):
```bash
DEEPGRAM_API_KEY=your_deepgram_api_key
```

#### After (AWS Transcribe):
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

### 3. Features

#### Silence Detection
AWS Transcribe implementation includes custom silence detection:
- **Default silence threshold**: 5 seconds
- Automatically sends accumulated transcript to AI after silence is detected
- Configurable in `server/ai-voice-service.ts` (line 415: `SILENCE_THRESHOLD_MS`)

#### Audio Processing
- Twilio sends audio in **8kHz μ-law** format
- Converted to **PCM** for AWS Transcribe
- Real-time transcription with partial and final results

## Migration Steps

### Step 1: Update Environment Variables

Update your `.env` file:

```bash
# Remove this line:
# DEEPGRAM_API_KEY=your_deepgram_api_key

# Add these lines:
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

### Step 2: AWS IAM Setup

1. **Create an IAM User** (or use existing):
   - Go to AWS Console → IAM → Users → Create User
   - Select "Programmatic access"

2. **Attach Policy**:
   - Attach the `AmazonTranscribeFullAccess` policy
   - Or create a custom policy with minimum permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "transcribe:StartStreamTranscription"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

3. **Get Credentials**:
   - Copy the **Access Key ID** and **Secret Access Key**
   - Add them to your `.env` file

### Step 3: Deploy

If you're using Render or similar platforms:
1. Update environment variables in your hosting platform
2. Redeploy the application

The migration is complete! The application will now use AWS Transcribe instead of Deepgram.

## Features Preserved

✅ **Initial greeting** - Still sends "Hello! I'm ready to talk. How can I help you today?"
✅ **Twilio webhooks** - All webhook endpoints remain unchanged
✅ **Media streaming** - Same WebSocket connection to Twilio
✅ **Real-time transcription** - Continuous speech-to-text
✅ **AI integration** - Kindroid API integration unchanged
✅ **TTS** - ElevenLabs and Google TTS fallback unchanged

## Key Differences

| Feature | Deepgram (Old) | AWS Transcribe (New) |
|---------|---------------|---------------------|
| **Silence Detection** | Built-in (Flux model) | Custom implementation (5s threshold) |
| **Pricing** | Pay per minute | Pay per second |
| **Authentication** | API Key | AWS IAM Credentials |
| **Partial Results** | `is_final: true` | `IsPartial: false` |
| **Models** | flux-general-en | Standard streaming |
| **Punctuation** | Configurable | Automatic |

## Troubleshooting

### Issue: No transcripts appearing
**Cause**: Audio format mismatch
**Fix**: Check that mulaw decoding is working properly. Logs should show "Audio buffered for AWS Transcribe"

### Issue: Transcripts not being sent to AI
**Cause**: Silence threshold too long or not detecting silence
**Fix**: Adjust `SILENCE_THRESHOLD_MS` in `server/ai-voice-service.ts` (line 415)

### Issue: AWS Credentials Error
**Cause**: Invalid or missing AWS credentials
**Fix**:
1. Verify credentials in `.env` file
2. Test AWS CLI: `aws transcribe help`
3. Check IAM user has transcribe permissions

### Issue: Connection timeouts
**Cause**: AWS Transcribe connection dropped
**Fix**: Check CloudWatch logs for AWS Transcribe errors

## Cost Comparison

### Deepgram
- Nova-2: $0.0043/minute
- Flux: ~$0.0054/minute (estimated)

### AWS Transcribe
- Standard: $0.00040/second ($0.024/minute)
- Medical: $0.00060/second ($0.036/minute)

**AWS Transcribe is typically more cost-effective for most use cases.**

## Monitoring

AWS Transcribe logs can be monitored via:
1. **Application logs**: Check logs for "AWS Transcribe" entries
2. **CloudWatch**: AWS Console → CloudWatch → Logs
3. **Metrics**: Monitor transcription duration and errors

## Rollback

If you need to rollback to Deepgram:

```bash
npm uninstall @aws-sdk/client-transcribe-streaming
npm install @deepgram/sdk
```

Then restore the original code from git:
```bash
git checkout HEAD~1 -- server/ai-voice-service.ts server/routes.ts
```

## Support

For issues or questions:
- AWS Transcribe Docs: https://docs.aws.amazon.com/transcribe/
- AWS Support: https://console.aws.amazon.com/support/
- SoulSync Issues: https://github.com/your-repo/issues

---

**Migration completed on**: $(date)
**Version**: 3.0 (AWS Transcribe)
