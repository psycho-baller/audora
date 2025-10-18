# Phone Number Dialog Simplification

## Problem
The phone number input was buggy because it automatically prepended "+1" to every keystroke, causing confusion:
- User types "5" → Shows "+15"
- User types "55" → Shows "+155"
- Complex formatting logic made it hard to use

## Solution
Simplified the entire flow:

### Before
```typescript
// Complex formatting on every keystroke
const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 10) {
    return `+1${digits}`;
  }
  return `+1${digits.slice(0, 10)}`;
};
```

### After
```typescript
// Simple: just clean and limit to 10 digits
const handlePhoneChange = (e) => {
  const value = e.target.value.replace(/\D/g, "");
  setPhoneNumber(value.slice(0, 10));
  setError("");
};

// Add +1 only when submitting
await onSubmit(`+1${phoneNumber}`);
```

## UI Changes

### Before
- Single input with "+1" automatically added
- Placeholder: "+1 (555) 123-4567"
- maxLength: 12

### After
- Static "+1" label shown to the left
- Clean input field for 10 digits only
- Placeholder: "5551234567"
- Type: "tel" (better mobile keyboard)
- Auto-limits to 10 digits

## User Experience

**Old Flow**:
1. User sees input
2. Starts typing
3. "+1" appears unexpectedly on left
4. Confusing and buggy feeling

**New Flow**:
1. User sees "+1" label (static)
2. Starts typing digits
3. Clean, simple input
4. Clear 10-digit limit
5. "+1" prepended on submit

## Validation

**Before**: Complex regex on formatted string
**After**: Simple length check

```typescript
// Old
const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+1\d{10}$/;
  return phoneRegex.test(phone);
};

// New
if (phoneNumber.length !== 10) {
  setError("Please enter exactly 10 digits");
  return;
}
```

## Button State

Submit button is disabled unless exactly 10 digits are entered:

```typescript
disabled={isSubmitting || phoneNumber.length !== 10}
```

## Benefits

1. **Clearer UX**: "+1" is always visible but not editable
2. **Simpler Code**: Removed complex formatting function
3. **Better Mobile**: `type="tel"` triggers numeric keyboard
4. **Less Buggy**: No unexpected text changes while typing
5. **Easier Validation**: Just check length === 10

## Example Usage

User wants to call: +1 (555) 123-4567

**Old way**:
- Type "5551234567"
- See "+15551234567" change with each keystroke
- Confusing

**New way**:
- See "+1" label
- Type "5551234567"
- Input shows exactly what you type
- Submit adds +1 automatically

## Code Location

File: `app/components/network/PhoneNumberDialog.tsx`

Key changes:
- Removed `formatPhoneNumber()` function
- Simplified `handlePhoneChange()`
- Updated UI to show static "+1" label
- Changed input type to "tel"
- Updated validation to simple length check
