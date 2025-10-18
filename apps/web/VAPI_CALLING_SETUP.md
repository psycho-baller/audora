# VAPI.ai Call Integration Setup

## Overview
Integrated VAPI.ai calling functionality that allows users to initiate phone calls directly from the contact detail page in the network section.

## Features Implemented

### 1. Call Button on Contact Detail Page
- **Location**: `/dashboard/network/:userId` (contact detail page header)
- **Behavior**:
  - If phone number exists: Initiates call immediately
  - If no phone number: Opens dialog to collect phone number
- **Visual States**:
  - Normal: "Call [FirstName]" with phone icon
  - Loading: "Calling..." with spinner
  - Disabled during active call

### 2. Phone Number Dialog
- **Component**: `PhoneNumberDialog.tsx`
- **Features**:
  - Input validation (US/Canada format)
  - Auto-formatting (+1XXXXXXXXXX)
  - Error handling and display
  - Cancel and submit actions
- **Validation**: Only accepts +1 followed by 10 digits

### 3. Backend Integration

#### Files Created/Modified:

**`convex/vapi.ts`** (NEW)
- `getPhoneNumber`: Query to fetch user's phone number
- `updatePhoneNumber`: Mutation to update user's phone number
- `initiateCall`: Action to initiate VAPI call

**`convex/users.ts`** (UPDATED)
- Added `updatePhoneNumber` mutation

**`convex/schema.ts`** (ALREADY HAD)
- `phoneNumber` field already exists in users table

**`app/routes/dashboard/network/$userId.tsx`** (UPDATED)
- Added call button
- Added phone number dialog
- Added call handling logic

**`app/components/network/PhoneNumberDialog.tsx`** (NEW)
- Phone number input dialog component

## Setup Instructions

### 1. Install Dependencies

```bash
npm install @vapi-ai/server-sdk
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# VAPI.ai Configuration
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
VAPI_WORKFLOW_ID=your_vapi_workflow_id
```

**Where to get these:**
1. Go to https://vapi.ai
2. Sign up/login to your account
3. **API Key**: Dashboard → API Keys → Create new key
4. **Phone Number ID**: Dashboard → Phone Numbers → Select your number → Copy ID
5. **Workflow ID**: Dashboard → Workflows → Select/Create workflow → Copy ID

### 3. Deploy to Convex

```bash
npx convex dev
```

This will:
- Generate TypeScript types for the new VAPI functions
- Deploy the new functions to your Convex backend
- Make the functions available to the frontend

### 4. Test the Integration

1. Navigate to `/dashboard/network`
2. Click on any contact
3. Click the "Call [Name]" button
4. If no phone number:
   - Dialog opens
   - Enter phone number (e.g., +15551234567)
   - Click "Call Now"
5. If phone number exists:
   - Call initiates immediately

## API Usage

### From Frontend

```typescript
// Get phone number
const phoneNumber = useQuery(api.vapi.getPhoneNumber, { 
  userId: contactId 
});

// Initiate call
const initiateCall = useAction(api.vapi.initiateCall);

await initiateCall({
  contactUserId: contactId,
  phoneNumber: "+15551234567" // optional, uses stored if not provided
});
```

### VAPI Call Configuration

The call is created with:
- **Phone Number ID**: From environment variable
- **Customer**: Contact's name and phone number
- **Workflow ID**: From environment variable (your VAPI workflow configuration)

## Phone Number Format

**Required Format**: `+1XXXXXXXXXX`
- Must start with +1 (US/Canada)
- Followed by exactly 10 digits
- No spaces, dashes, or parentheses in stored format

**Examples**:
- ✅ `+15551234567`
- ❌ `5551234567` (missing +1)
- ❌ `+1 555 123 4567` (has spaces)
- ❌ `+15551234` (too short)

## User Flow

```
Contact Detail Page
  ↓
User clicks "Call [Name]"
  ↓
Check if phone number exists
  ├─ YES → Initiate call immediately
  └─ NO → Show phone number dialog
      ↓
  User enters phone number
      ↓
  Submit form
      ↓
  Save to database
      ↓
  Initiate call
```

## Error Handling

### Frontend
- Form validation errors shown in dialog
- Call errors shown via alert (TODO: Replace with toast)
- Loading states prevent duplicate calls

### Backend
- Invalid phone format throws error
- Missing contact throws error
- VAPI API errors caught and returned

## Database Schema

```typescript
users: {
  _id: Id<"users">,
  name?: string,
  email?: string,
  image?: string,
  phoneNumber?: string,  // NEW: +1XXXXXXXXXX format
  tokenIdentifier: string
}
```

## Security Considerations

1. **API Key**: Never expose VAPI_API_KEY to frontend
2. **Phone Validation**: Server-side validation prevents invalid numbers
3. **Authentication**: All mutations/actions require authenticated user
4. **Rate Limiting**: Consider adding rate limits to prevent abuse

## Future Enhancements

### Potential Features:
1. **Call History**: Store call records in database
2. **Call Status**: Real-time call status updates via webhooks
3. **Call Recording**: Access call recordings from VAPI
4. **Call Analytics**: Track call duration, success rate, etc.
5. **Batch Calling**: Call multiple contacts
6. **Call Scheduling**: Schedule calls for later
7. **SMS Integration**: Send SMS before/after calls
8. **Voicemail Detection**: Handle voicemail scenarios
9. **Call Notes**: Add notes after calls
10. **CRM Integration**: Sync with existing CRM systems

### Webhook Integration:
VAPI can send webhooks for call events:
- Call started
- Call ended
- Call failed
- Transcription available
- Recording available

Example webhook handler:
```typescript
// convex/http.ts
export default httpRouter();

http.route({
  path: "/vapi/webhook",
  method: "POST",
  handler: async (request, { runMutation }) => {
    const payload = await request.json();
    
    // Handle different event types
    switch (payload.event) {
      case "call.started":
        // Update call status
        break;
      case "call.ended":
        // Save call duration, record link
        break;
      case "transcript.ready":
        // Save transcript
        break;
    }
    
    return new Response(JSON.stringify({ success: true }));
  },
});
```

## Troubleshooting

### Type Errors
**Issue**: `Property 'vapi' does not exist on type...`

**Solution**: Run `npx convex dev` to regenerate types

### Call Fails Immediately
**Issue**: Call initiates but fails

**Possible Causes**:
- Invalid phone number format
- Insufficient VAPI credits
- Invalid assistant ID
- Phone number blocked/invalid

**Check**: VAPI dashboard logs for error details

### Phone Dialog Doesn't Open
**Issue**: Button click doesn't show dialog

**Check**:
- Browser console for errors
- React DevTools for component state
- Network tab for API calls

## Testing

### Manual Testing Checklist:
- [ ] Call button appears on contact detail page
- [ ] Clicking button with no phone shows dialog
- [ ] Clicking button with phone initiates call
- [ ] Phone validation works correctly
- [ ] Error messages display properly
- [ ] Loading states work correctly
- [ ] Phone number saves to database
- [ ] Call initiates successfully
- [ ] VAPI receives call request
- [ ] Contact receives call

### Test Phone Numbers:
VAPI provides test numbers for development. Check their documentation for current test numbers.

## Cost Considerations

VAPI charges per minute of call time. Typical costs:
- US/Canada calls: ~$0.01-0.03/minute
- International: Varies by country

Monitor usage in VAPI dashboard to track costs.

## Support

- **VAPI Documentation**: https://docs.vapi.ai
- **VAPI Discord**: https://discord.gg/vapi
- **VAPI Support**: support@vapi.ai

## File Structure

```
mru-2025/
├── app/
│   ├── components/
│   │   └── network/
│   │       └── PhoneNumberDialog.tsx (NEW)
│   └── routes/
│       └── dashboard/
│           └── network/
│               └── $userId.tsx (UPDATED)
├── convex/
│   ├── vapi.ts (NEW)
│   ├── users.ts (UPDATED)
│   └── schema.ts (already had phoneNumber)
└── .env (ADD VAPI CREDENTIALS)
```

## Notes

- The `@ts-ignore` comments in the frontend will no longer be needed after running `npx convex dev`
- Phone numbers are validated on both frontend and backend for security
- Consider adding toast notifications instead of alert() for better UX
- The dialog auto-formats phone numbers as users type
- Phone numbers are stored in E.164 format (+1XXXXXXXXXX)
