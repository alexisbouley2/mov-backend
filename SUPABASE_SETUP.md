# Supabase Setup Instructions

## Twilio Configuration

### Enable Auth - Sign/In Providers - Phone

1. Go to your Supabase dashboard
2. Navigate to Authentication > Providers
3. Enable Phone provider
4. Paste your Twilio information:
   - **Twilio Account SID**: Check Bitwarden
   - **Twilio Auth Token**: Check Bitwarden
   - **Twilio Message Service SID**: Check Bitwarden

### Phone Confirmation Settings

- Turn on "Enable phone confirmations"
- **SMS OTP Expiry**: 600 seconds
- **SMS OTP Length**: 6
- **SMS Message**: `Your code is {{ .Code }}`

### Disable Email Provider

- Disable Auth Email Provider

## Database Configuration

### Enable Realtime on Message Table

Run the following SQL commands in your Supabase SQL editor:

```sql
-- 1. Grant basic permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- Enable RLS on all tables that have policies
ALTER TABLE "EventParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;

-- Enable realtime for Message table (chat)
ALTER TABLE "Message" REPLICA IDENTITY FULL;

CREATE POLICY "Users can see their own event participation"
ON "EventParticipant"
FOR SELECT
TO authenticated
USING ("userId" = (auth.uid())::text);

CREATE policy "Users can read messages for their events"
on "public"."Message"
to authenticated
using (
  (EXISTS ( SELECT 1
    FROM "EventParticipant"
    WHERE (("EventParticipant"."eventId" = "Message"."eventId") AND ("EventParticipant"."userId" = (auth.uid())::text))
  ))
);

CREATE policy "Users can insert own profile"
on "public"."User"
to authenticated
with check (
  ("id" = (auth.uid())::text)
);

CREATE policy "Users can update own profile"
on "public"."User"
to authenticated
using (
  ("id" = (auth.uid())::text)
)
with check (
  ("id" = (auth.uid())::text)
);

CREATE policy "Users can view own profile"
on "public"."User"
to authenticated
USING ("id" = (auth.uid())::text);
```
