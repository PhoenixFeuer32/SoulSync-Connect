# SoulSync Connect 3.0 - Feature Todo List

> Extracted from preserved conversation history (Claude.md)
> Last updated: 2025-12-17

---

## ✅ Completed Tasks

- [x] **Fix logger unknown error access**
  - Narrow the 'error' value in the catch block inside server/logger.ts before accessing .message to satisfy TypeScript and avoid runtime surprises.

- [x] **Fix routes imports & inline import**
  - Update relative imports in server/routes.ts to include explicit .js extensions and move any import declarations to top-level (no imports inside functions).

- [x] **Resolve Drizzle type errors in storage.ts**
  - Review getApiCredentials and getErrorLogs methods - they reassign `q` variable to different Drizzle select types. Need to refactor conditional logic to avoid type conflicts. Create fresh query variables in each branch instead.

- [x] **Migrate from Deepgram to AWS Transcribe**
  - Remove @deepgram/sdk import, add @aws-sdk/client-transcribe-streaming
  - Implement AWS Transcribe streaming with custom silence detection (5s threshold)
  - Configure AWS credentials via environment variables
  - **Status:** COMPLETE - Using Node.js Readable stream for proper audio handling, async response processing, stream cleanup on completion.

- [x] **Create .env file with AWS credentials**
  - Create `/home/phoenix/Dev/SoulSync-Connect 3.0/.env` with DATABASE_URL (Postgres), CREDENTIAL_ENCRYPTION_KEY (32+ chars), and AWS credentials (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  - **Status:** .env file already exists with required credentials.

- [x] **Add message logging for Sofia's responses**
  - Capture and log text responses from Sofia (AI companion) to track conversation history and debugging
  - Store message logs in database via storage layer

- [x] **Build SONG/ARTIST format listener**
  - Create detection logic in ai-voice-service.ts or routes.ts to identify when Sofia responds with SONG/ARTIST format
  - Parse the extracted music metadata

- [x] **Add webhook forwarding to Make**
  - Set up HTTP POST endpoint to forward song/artist data from SoulSync to Make.com webhook
  - Enable automation workflow integration (Spotify playlist creation, etc)

- [x] **Create Spotify playlist history UI component**
  - Build React component in client/src/components to display historical Spotify playlists added via Sofia's responses
  - Show track count and timestamps

---

## 🚧 In Progress / Needs Testing

- [ ] **Test Make scenario after work**
  - End-to-end test of full workflow: Sofia responds with SONG/ARTIST → webhook to Make → Spotify playlist updated → UI reflects new entry
  - AWS Transcribe now properly streaming audio via Node.js Readable stream with async result processing

---

## 📋 New Features to Implement

### High Priority
- [ ] **Sofia's Music Choice Section in Spotify UI**
  - Display Sofia's current music selections
  - Show recently added songs
  - Track interaction history

### Medium Priority
- [ ] **Improve SONG/ARTIST pattern detection**
  - Support both "SONG/ARTIST" and "ARTIST/SONG" formats
  - Make comma optional in pattern detection
  - Add debug logging for pattern detection (increase limit to 3000 chars)

### Low Priority
- [ ] **Enhanced error handling for AWS Transcribe**
  - Better silence detection tuning
  - Connection retry logic
  - Stream recovery on failures

---

## 🐛 Known Issues

- Build errors with rollup (may need `npm i` after removing package-lock.json and node_modules)
- Database connection issues logged in logs/ directory

---

## 📝 Technical Notes

### AWS Transcribe Configuration
- Using Node.js Readable stream for audio handling
- Custom silence detection: 5 second threshold
- Async response processing for real-time transcription

### Make.com Integration
- Webhook endpoint configured for Spotify automation
- Song/artist data forwarding working

### Database Schema
- Message logs stored in database
- Call logs track Sofia interactions
- Error logs for debugging

---

## 🔗 Related Files
- [Claude.md](./Claude.md) - Full conversation history
- [server/ai-voice-service.ts](./server/ai-voice-service.ts) - Sofia voice service
- [server/routes.ts](./server/routes.ts) - API routes and webhooks
- [shared/schema.ts](./shared/schema.ts) - Database schema

---

*Generated from conversation history - Update as features are completed*
