# Feature: Toggleable Relationship Analytics

## Overview

Added comprehensive, toggleable analytics to the contact detail page that provide deep insights into your relationship with each contact.

## Toggle Feature

- **Location**: Contact detail page header (`/dashboard/network/:userId`)
- **Button**: "Show Analytics" / "Hide Analytics" with icon
- **State**: Defaults to hidden, user can toggle on/off
- **Visual**: Button highlights when analytics are shown

## Analytics Included

### 1. Communication Balance

**Visual**: Horizontal bar charts showing percentage breakdown

**Metrics**:

- Your contribution percentage
- Their contribution percentage
- Based on transcript turn counts

**Use Case**: Understand if conversations are balanced or one-sided

### 2. Engagement Metrics (4 cards)

**Average Conversation Duration**

- Shows typical length of your conversations
- Formatted as hours/minutes
- Icon: Target 🎯

**Engagement Score**

- Average number of exchanges per conversation
- Higher = more interactive conversations
- Icon: Zap ⚡

**Frequency**

- Average days between conversations
- Only shown if multiple conversations exist
- Icon: Calendar 📅

**Total Exchanges**

- All-time transcript turns combined
- Shows overall interaction volume
- Icon: Trending Up 📈

### 3. Top Meeting Locations

**Conditions**: Only shown if location data exists

**Display**:

- Top 3 most common locations
- Count of meetings at each location
- Sorted by frequency (most to least)
- Icon: Map Pin 📍

**Use Case**: Identify preferred meeting spots

### 4. Conversation Status Breakdown

**Shows**: Distribution of conversation statuses

- Active conversations
- Ended conversations
- Pending conversations

**Display**: Color-coded badges matching status colors

- Active: Green
- Ended: Blue
- Pending: Yellow

## Technical Implementation

### Analytics Calculations

All metrics are calculated client-side from the existing contact details data:

```typescript
const analytics = {
  yourBalance: Math.round((currentUserTurns / totalTurns) * 100),
  contactBalance: Math.round((contactTurns / totalTurns) * 100),
  avgDuration: totalDuration / conversationCount,
  avgDaysBetween: timeSpan / (conversationCount - 1),
  locations: aggregateLocations(),
  statusBreakdown: countByStatus(),
  engagementScore: totalTurns / conversationCount
}
```

### Performance

- No additional API calls required
- Calculations use existing data from `getContactDetails` query
- Instant toggle - no loading time
- Memoized calculations via React

### Responsive Design

- 2-column grid on desktop
- Single column on mobile
- Proper spacing and readability
- Visual hierarchy with icons and colors

## User Benefits

### Pre-Meeting Insights

- Quickly gauge conversation balance before next meeting
- See typical conversation length to plan time
- Review interaction frequency

### Relationship Health

- Identify one-sided conversations
- Track engagement trends
- Understand meeting patterns

### Location Planning

- See where you typically meet
- Make informed location choices for next meeting

### Conversation Management

- See pending conversations to follow up
- Track completed vs ongoing discussions

## UI/UX Details

### Visual Design

- Card-based layout with border
- Consistent spacing (6-unit gap system)
- Section dividers for organization
- Color-coded progress bars

### Icons Used

- **BarChart3**: Analytics header
- **Activity**: Communication balance
- **Target**: Average duration
- **Zap**: Engagement score
- **Calendar**: Frequency
- **TrendingUp**: Total exchanges
- **MapPin**: Locations
- **ChevronUp/Down**: Toggle state

### Color System

- Primary color for user data
- Blue for contact data
- Status-specific colors (green/blue/yellow)
- Muted colors for labels

## Future Enhancements

### Potential Additions

1. **Timeline View**: Conversation frequency over time graph
2. **Sentiment Tracking**: Positive/neutral/negative trend
3. **Topic Analysis**: Most discussed topics across conversations
4. **Response Time**: Average time between exchanges
5. **Speaking Patterns**: Time of day preferences
6. **Conversation Starters**: AI-suggested topics based on history
7. **Export Analytics**: Download relationship report as PDF
8. **Comparison**: Compare this relationship to others

### Advanced Features

- Predictive insights (when you'll likely meet next)
- Relationship strength score
- Communication style analysis
- Conversation momentum tracking

## Files Modified

**Updated**:

- `app/routes/dashboard/network/$userId.tsx`
  - Added `useState` for toggle
  - Added analytics calculations
  - Added toggle button in header
  - Added comprehensive analytics section
  - Imported additional Lucide icons

**No backend changes required** - uses existing API data

## Testing

### Test Cases

- [ ] Toggle button shows/hides analytics section
- [ ] Communication balance bars render correctly
- [ ] Percentages add up to 100%
- [ ] Average duration calculates correctly
- [ ] Frequency only shows when multiple conversations exist
- [ ] Locations section only shows when location data exists
- [ ] Status badges show correct colors
- [ ] All metrics handle edge cases (0 conversations, etc.)
- [ ] Responsive design works on mobile
- [ ] Toggle state persists during navigation (doesn't currently persist across page refreshes)

### Edge Cases Handled

- Division by zero (no conversations)
- Single conversation (no frequency metric)
- No location data (section hidden)
- Zero transcript turns (shows 50/50 balance)

## Example Insights

**Balanced Relationship**:

- You: 48%, Them: 52%
- Engagement: 25 exchanges/conversation
- Frequency: Every 7 days

**One-Sided**:

- You: 75%, Them: 25%
- May indicate need to listen more

**High Engagement**:

- Engagement Score: 50+
- Long, interactive conversations

**Infrequent Contact**:

- Frequency: 30+ days
- May want to reconnect more often
