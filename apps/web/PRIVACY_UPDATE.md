# Privacy Update: User-Scoped Analytics & Facts

## Summary
Updated the conversation view to only show analytics and facts for the currently logged-in user, improving privacy and making the experience more personalized.

## Changes Made

### 1. **Current User Detection**
Added `getCurrentUser` query to identify the logged-in user:
```tsx
const currentUser = useQuery(api.users.getCurrentUser);
```

### 2. **Filtered Data Display**
Created filtered arrays to only show current user's data:
```tsx
const currentUserAnalytics = conversationAnalytics.filter(
  (analytics) => currentUser && analytics.userId === currentUser._id
);

const currentUserFacts = conversationFacts.filter(
  (fact) => currentUser && fact.userId === currentUser._id
);
```

### 3. **Auto-Analysis Updates**
- **Before**: Analyzed both participants (initiator + scanner)
- **After**: Only analyzes the current user's speech

```tsx
// Only analyze if we have a current user and haven't analyzed them yet
if (conversation && currentUser && currentUserAnalytics.length === 0 && !isAnalyzing) {
  await analyzeUserSpeech({
    conversationId: conversationId as Id<"conversations">,
    userId: currentUser._id,
  });
}
```

### 4. **UI Updates**

#### Analytics Section
- Shows only current user's communication analysis
- Updated header to show "You" instead of other participant names

#### Key Facts Section
- **Before**: "Key Facts" - showed facts for all participants
- **After**: "Key Facts About You" - shows only current user's facts
- Simplified layout (no need to separate by speaker)

#### AI Suggestions Button
- Triggers suggestions only for the current user
- Uses `currentUser._id` instead of hardcoded initiator

#### Download Transcript
- Still includes full transcript
- Facts section only shows current user's facts

## Privacy Benefits

1. **✅ User Privacy**: Users only see analytics about their own communication patterns
2. **✅ Focused Feedback**: Users get personalized insights without seeing others' metrics
3. **✅ Reduced Compute**: Only analyzes current user instead of all participants
4. **✅ GDPR Friendly**: Users can only access their own analyzed data

## Testing Checklist

- [ ] Login as User A, verify only User A's analytics appear
- [ ] Login as User B in same conversation, verify only User B's analytics appear
- [ ] Verify "Get AI Suggestions" only affects current user
- [ ] Download transcript and verify facts section only has current user
- [ ] Test solo conversation (no scanner) - should work normally
- [ ] Check analytics auto-triggers only once per user

## Technical Notes

- The full `conversationAnalytics` array still fetches all analytics (for future use if needed)
- Filtering happens client-side for simplicity
- Could optimize backend to only fetch current user's analytics in future
- CSS warnings in `app.css` are expected - Tailwind @directives handled by build system
