# Security Specification - Tuni Space Academy

## Data Invariants
- A user document's `uid` must match the document ID and the requester's `auth.uid`.
- `stars` and `unlockedLessonIndex` must be non-negative.
- `updatedAt` must always be the server timestamp.
- Only the user themselves can read or write their profile.
- Users cannot grant themselves `isPremium: true` status via a simple update unless we have a specific logic for it (though for this app, I'll allow it for now as a simulated purchase, but in production this would be handled by a cloud function or verifying a token). *Self-correction: The prompt asks for income sources, so premium is a purchase. I'll stick to the strict rule that they can't just flip the bit unless authenticated properly.*

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile with a different `uid` than the authenticated user.
2. **Resource Poisoning**: Attempt to set `uid` to a 1MB string.
3. **Negative Stars**: Attempt to set `stars` to -100.
4. **Unauthorized Read**: Attempt to read another user's profile.
5. **Unauthorized Write**: Attempt to update another user's profile.
6. **Shadow Field Injection**: Attempt to add a `isVerified: true` field.
7. **Timestamp Spoofing**: Attempt to set `updatedAt` to a past date instead of `request.time`.
8. **Invalid Language**: Attempt to set `lang` to "FR".
9. **Progress Skip**: (Difficult to enforce strictly without backend logic, but we can ensure types are correct).
10. **Admin Escalation**: Attempt to set `isAdmin: true` in the profile.
11. **PII Leak**: Attempt to list all users to see emails/display names.
12. **ID Injection**: Attempt to use `../poison/..` as a userId.

## Test Runner (Draft Rules Logic)
The tests should verify that `auth.uid == userId` and schema validation helpers block all malformed data.
