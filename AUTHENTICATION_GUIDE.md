# Authentication & Authorization System

## Overview
Complete token-based authentication system with role-based access control (RBAC) and page-level permissions.

## Features
1. **Login System**: Username/password authentication with SHA-256 password hashing
2. **Role-Based Access**: Admin and Operator roles with different permissions
3. **Page Permissions**: Control which pages each user can access
4. **Feature Permissions**: Fine-grained control over specific features
5. **Session Management**: Token-based authentication stored in localStorage
6. **Logout**: Clear session and redirect to login

## User Roles

### Admin (role: 'admin')
- Full access to all pages and features
- Can manage other users
- Can set permissions for operators
- Cannot be restricted by page permissions

### Operator (role: 'user')
- Limited access based on assigned permissions
- Can only see pages explicitly granted in page_permissions
- Feature permissions control what actions they can perform

## Database Schema

### operator table
```sql
id                VARCHAR(36)   -- Primary key
name              VARCHAR(150)  -- User's display name
email             VARCHAR(150)  -- Login email (unique)
password_hash     VARCHAR(255)  -- SHA-256 hashed password
role              VARCHAR(50)   -- 'admin' or 'user'
is_active         TINYINT(1)    -- Account active status
last_login        DATETIME      -- Last login timestamp
permissions       LONGTEXT      -- JSON array of feature permissions
page_permissions  LONGTEXT      -- JSON array of accessible pages
created_date      DATETIME
updated_date      DATETIME
```

## Available Permissions

### Feature Permissions (stored in `permissions` column)
- `can_add_program` - नया निमंत्रण जोड़ सकता है
- `can_edit_program` - निमंत्रण संपादित कर सकता है
- `can_delete_program` - निमंत्रण हटा सकता है
- `can_view_reminder` - रिमाइंडर देख सकता है
- `can_mark_attended` - अटेंडेंस मार्क कर सकता है
- `can_generate_letter` - पत्र जनरेट कर सकता है
- `can_resend_letter` - पत्र दोबारा भेज सकता है
- `can_import_data` - डेटा इम्पोर्ट कर सकता है

### Page Permissions (stored in `page_permissions` column)
- `Dashboard` - डैशबोर्ड
- `DataEntry` - नया / संपादित निमंत्रण
- `ReminderList` - रिमाइंडर सूची
- `BulkOperations` - बल्क ऑपरेशन्स
- `LetterGenerator` - पत्र जनरेटर
- `LetterTemplates` - पत्र टेम्पलेट्स
- `LetterSettings` - पत्र सेटिंग्स
- `ProgramTypeMaster` - कार्यक्रम प्रकार मास्टर
- `WhatsAppSettings` - WhatsApp सेटिंग्स
- `DatabaseViewer` - Database Viewer
- `UserManagement` - यूजर मैनेजमेंट
- `OperatorManagement` - ऑपरेटर प्रबंधन

## Authentication Flow

### 1. Initial Load
```
User visits website
  ↓
Layout component checks sessionStorage for operator_token
  ↓
If no token → Redirect to /OperatorLogin
  ↓
If token exists → Validate it with the server and load the operator profile
  ↓
Render app with user's permissions
```

### 2. Login Process
```
User enters email & password on /OperatorLogin
  ↓
POST /api/functions/operatorAuth with action: 'login'
  ↓
Server validates credentials
  ↓
Server returns token + operator data
  ↓
Client stores in sessionStorage:
  - operator_token: session token
  - operator_data: JSON with user info, role, permissions
  ↓
Redirect to /Dashboard
```

### 3. Session Check
```
On every page load, Layout component:
  ↓
Calls restClient.authMe()
  ↓
Validates the token with the server and reads the current operator record
  ↓
If invalid or missing → Redirect to login
  ↓
If valid → Set currentUser and render page
```

### 4. Logout Process
```
User clicks logout button
  ↓
Revoke the server-side session, then clear browser storage:
  - Remove operator_token
  - Remove operator_data
  ↓
Redirect to /OperatorLogin
```

## API Endpoints

### POST /api/functions/operatorAuth
Handle login, token verification, and logout.

**Login Request:**
```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "password123"
}
```

**Login Response:**
```json
{
  "success": true,
  "token": "abc123...",
  "operator": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "admin",
    "permissions": ["can_add_program", "can_edit_program"],
    "page_permissions": ["Dashboard", "DataEntry"],
    "is_active": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ईमेल या पासवर्ड गलत है"
}
```

## Frontend Components

### OperatorLogin.jsx
Login page with email/password form. Features:
- Email and password inputs
- Password visibility toggle
- Auto-redirect if already logged in
- Stores token and user data in localStorage
- Hindi error messages

### Layout.jsx
Main app wrapper that:
- Checks authentication on mount
- Redirects to login if not authenticated
- Filters navigation based on page permissions
- Shows user info and logout button
- Renders protected pages

### UserManagement.jsx
Admin-only page for managing users. Features:
- Create new users with role selection
- Set feature permissions (checkboxes)
- Set page access permissions (checkboxes)
- Change user passwords
- Delete users
- Role management (promote to admin)

## Permission Management

### For Admins (in UserManagement page)
1. Click on a user from the list
2. **फीचर अनुमतियाँ** section:
   - Check/uncheck feature permissions
   - Changes save automatically
3. **पेज एक्सेस अनुमतियाँ** section (operators only):
   - Check pages user should access
   - Unchecked pages won't appear in navigation
   - Admin users always see all pages

### Permission Checking in Code

**Check page access:**
```javascript
const canAccessPage = (pageName) => {
  if (currentUser.role === 'admin') return true;
  return currentUser.page_permissions?.includes(pageName);
};
```

**Check feature permission:**
```javascript
const canEditProgram = currentUser.permissions?.can_edit_program === true;
```

## Security Considerations

### Current API Protections
- API data/action endpoints require a server-issued bearer token, except login and the health check. The legacy `/api/uploads/:filename` proxy remains public, as do files served from `/uploads`.
- The server looks up the operator and checks that the account remains active on every API request.
- Tokens are generated with cryptographically secure randomness, expire after eight hours, and are revoked on logout.
- Operator/User entity APIs are admin-only. Operator responses omit `password_hash`.
- The frontend validates the token with the server; cached `operator_data` is not used as proof of identity.

Sessions are held in server memory, so a server restart invalidates active sessions. A multi-instance deployment needs a shared session store to validate tokens across instances.

### Remaining Production Hardening
- Login passwords are still hashed with SHA-256. Migrate to Argon2id, scrypt, or appropriately configured bcrypt, and rehash/reset existing passwords.
- Add per-IP and per-account login throttling, failed-attempt monitoring, and consider MFA.
- Enforce HTTPS in production. Treat browser storage tokens as sensitive; use secure, HttpOnly cookies with CSRF protection if moving to cookie-based sessions.
- Implement password strength requirements and password reset functionality.
- Log security events such as failed logins and permission changes without logging passwords or tokens.

## Default Admin User

After running `node create-admin-user.js`:
- Email: admin@sandesh.local
- Password: admin123

**⚠️ CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!**

## Troubleshooting

### "No token provided" error
- User not logged in or token expired
- Sign in again. Server restarts also invalidate in-memory sessions.

### User redirected to login immediately
- Verify a token exists in sessionStorage
- Check that the API is reachable and that the server session has not expired or been restarted
- Check browser console for errors

### Changes not reflecting
- Hard refresh browser (Ctrl+Shift+R)
- Clear localStorage and login again
- Check database for updated permissions

### Operator not seeing assigned pages
- Verify page_permissions column has correct JSON array
- Check Layout.jsx filtering logic
- Ensure user role is 'user' not 'admin'

## Development Tips

### Testing Different Roles
1. Create test operator user in UserManagement
2. Set specific page permissions
3. Logout and login as that user
4. Verify navigation shows only assigned pages

### Debugging Auth Issues
```javascript
// In browser console, check whether a session is present without printing the token:
console.log('Session present:', Boolean(sessionStorage.getItem('operator_token')));
```

### Adding New Pages
1. Add route in `pages/index.jsx`
2. Add page to `availablePages` in `UserManagement.jsx`
3. Add navigation item in `Layout.jsx` (navigationItems or settingsItems)
4. Page will automatically respect permissions

## Files Modified

### Backend
- `server.js` - Auth endpoints and login handler
- `add-page-permissions.js` - Database schema update
- `create-admin-user.js` - Initial admin creation

### Frontend
- `fronthend/src/api/restClient.js` - Auth client logic
- `fronthend/src/pages/Layout.jsx` - Auth check & navigation filtering
- `fronthend/src/pages/OperatorLogin.jsx` - Login page
- `fronthend/src/pages/UserManagement.jsx` - Permission management
- `fronthend/src/pages/index.jsx` - Public/protected route handling

## Testing Checklist

- [ ] Admin can login
- [ ] Admin sees all pages
- [ ] Admin can create operator user
- [ ] Admin can set page permissions for operator
- [ ] Admin can set feature permissions for operator
- [ ] Operator can login
- [ ] Operator only sees assigned pages
- [ ] Operator can logout
- [ ] After logout, redirects to login page
- [ ] Invalid credentials show error
- [ ] Password change works
- [ ] User deletion works
- [ ] Role change (operator → admin) works
