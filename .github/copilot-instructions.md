# Sandesh Invitation Manager - AI Agent Instructions

## Project Overview
Full-stack invitation management system for Hindu ceremonies (विवाह, गृहप्रवेश, etc.) with letter generation, WhatsApp reminders, and visual report designer. MySQL backend with Express API server, React + Vite frontend.

## Architecture

### Stack Split (Dual Package.json Pattern)
- **Root**: Backend + shared dependencies (`server.js`, utility scripts)
- **`fronthend/`**: Separate Vite + React SPA with own package.json
- **Important naming quirk**: Directory is `fronthend` (not `frontend`) - appears throughout codebase

### Entity-Table Mapping (Critical)
Frontend entity names ≠ database table names. See `ENTITY_TABLES` in [server.js](../server.js#L148-L160):
```javascript
ProgramType → programtype
Pragram → pragram  // Note: "Pragram" is intentional (program/invitation)
LetterTemplate → lettertemplate
LetterSettings → lettersettings
AppSettings → appsettings
Operator → operator
User → operator  // User entity maps to same operator table
PoliticianType → politician_type
Politician → politician
Mandal → mandal
```
Always use frontend entity names in API calls; server handles mapping.

### API Layer Architecture
- **Development**: Direct MySQL REST API via `restClient.js` hitting Express server
- **Entity abstraction**: [entities.js](../fronthend/src/api/entities.js) exports `makeEntity()` wrappers (list/get/create/update/delete)
- **Base44 compatibility**: Designed to swap between local REST and Base44 SDK (legacy references remain)
- **Mock server**: `fronthend/mock-server/index.js` for frontend-only dev (not actively used)

## Development Workflows

### Starting Development
```bash
# Terminal 1: Backend API (port 5000)
npm run api

# Terminal 2: Frontend (port 5173)
npm run frontend:dev  # or cd fronthend && npm run dev
```

### Database Schema Changes
1. Update MySQL directly or write script like [update-lettersettings-schema.js](../update-lettersettings-schema.js)
2. Use `dotenv` for DB credentials from [../.env](../.env)
3. Check existing columns before ALTER TABLE (see schema scripts pattern)

### Environment Variables
- Root: [../.env](../.env) - MySQL connection (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT)
- Frontend: [fronthend/.env.development](../fronthend/.env.development) - Sets `VITE_BASE44_API_URL=http://localhost:3000/api`
- **Port mismatch note**: Frontend expects API on :3000 but root .env defaults to :5000 - adjust as needed

## Critical Patterns

### 1. React Query State Management
All data fetching uses `@tanstack/react-query` with strict patterns:
```jsx
const { data: programs } = useQuery({
  queryKey: ['programs'],
  queryFn: () => restClient.listEntities('Pragram'),
  staleTime: 5 * 60 * 1000,  // Cache for 5 min
  refetchOnWindowFocus: false,
});

const createMutation = useMutation({
  mutationFn: (data) => restClient.createEntity('Pragram', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    toast.success("सफलतापूर्वक जोड़ा गया!");
  },
});
```
Always invalidate related queries after mutations (see [DataEntry.jsx](../fronthend/src/pages/DataEntry.jsx#L55-L69)).

### 2. Hindi UI Text Convention
UI labels and toast messages use Devanagari script. Examples from [Layout.jsx](../fronthend/src/pages/Layout.jsx#L21-L51):
```jsx
{ title: "डैशबोर्ड", url: createPageUrl("Dashboard"), icon: Home }
{ title: "नया / संपादित निमंत्रण", url: createPageUrl("DataEntry"), icon: Plus }
```
Maintain this bilingual pattern for user-facing text.

### 3. Visual Designer System
Two-mode letter editor ([LetterSettings.jsx](../fronthend/src/pages/LetterSettings.jsx#L9)):
- **Basic Settings Tab**: Form-based letterhead positioning
- **Visual Designer Tab**: Drag-and-drop canvas ([VisualReportDesigner.jsx](../fronthend/src/components/letter/VisualReportDesigner.jsx))
  - Stores design as JSON in `lettersettings.design_template` column
  - PDF generation via Puppeteer endpoint `/generate-pdf`
  - See [SETUP_VISUAL_DESIGNER.md](../SETUP_VISUAL_DESIGNER.md) for full architecture

### 4. File Upload Pattern
Multer handles uploads to `/uploads` directory:
```javascript
// Server: POST /upload or /api/integrations/Core/UploadFile
// Returns: { success: true, url: '/uploads/filename-123.png' }
```
Frontend stores returned URL in entity fields (`letterhead_url`, `signature_url`). Files served statically.

### 5. Page Routing Convention
Uses utility [utils/index.ts](../fronthend/src/utils/index.ts) `createPageUrl()`:
```jsx
navigate(createPageUrl("Dashboard"));  // Not hardcoded "/dashboard"
```
Page name constants match component names in [pages/](../fronthend/src/pages/) directory.

## Component Architecture

### shadcn/ui Components
Heavy use of Radix primitives ([components/ui/](../fronthend/src/components/ui/)). When adding new components:
- Import from `@/components/ui/component-name`
- Use `clsx` + `class-variance-authority` for conditional styling
- Follow existing patterns in [button.jsx](../fronthend/src/components/ui/button.jsx), [card.jsx](../fronthend/src/components/ui/card.jsx)

### Form Handling
- React Hook Form with Zod validation ([ProgramForm.jsx](../fronthend/src/components/forms/ProgramForm.jsx))
- Auto-increment `Sn` (serial number) field via highest-value query
- Date formatting: `date-fns` for `parseISO`, `format`

## Database Conventions

### ID Fields
- All tables use numeric auto-increment `id` (not UUID)
- Frontend treats as string in some contexts, numeric in queries
- Critical: IDs are consistent across entities (no prefix/suffix)

### Program (Pragram) Schema
Core entity has fields like:
- `Sn`: Serial number (auto-incremented from max + 1, starts ~6000)
- `Nondani`: Inviter name (नोंदणी)
- `Program_Date`: Date of ceremony
- `Program_type`: FK to `programtype.id`
- `Mobile1`, `Mobile2`: Contact fields

### Letter Settings
Stores page layout config:
- `page_size`, `page_width`, `page_height`, `margin_*`
- `letterhead_url`, `signature_url` (paths to uploaded images)
- `design_template`: JSON for visual designer state
- Only one active record typically exists (fetch first valid from list)

## Known Quirks & Gotchas

1. **"fronthend" spelling**: Not a typo - used consistently across paths
2. **Entity name "Pragram"**: Intentional (not "Program") - maps to `pragram` table
3. **Port confusion**: Root package.json PORT=5000, but frontend expects :3000 in some configs
4. **Auth behavior**: Login system now enforces authentication - uses token-based auth stored in localStorage. `/api/auth/isAuthenticated` validates tokens (see [AUTHENTICATION_GUIDE.md](../AUTHENTICATION_GUIDE.md))
5. **restClient fallback logic**: Tries multiple endpoint patterns (`/api/entities/${entity}`, `/api/${entity.toLowerCase()}`) - see [restClient.js](../fronthend/src/api/restClient.js#L30-L45)
6. **Politician system**: Includes automated birthday/anniversary WhatsApp wishes sent daily at 13:00 (1:00 PM) via cron job in server.js

## Debugging & Utilities

### Utility Scripts (Root Level)
- `check-program-data.js`: Verify Pragram records
- `check-lettersettings.js`: Inspect letter config
- `clean-lettersettings.js`: Remove corrupted records
- `test-db.js`: Database connection tester

Run with: `node script-name.js`

### Common Issues
- **DB connection fails**: Check MySQL service running, verify [../.env](../.env) credentials
- **Frontend 404s**: Ensure API port matches `VITE_BASE44_API_URL` in [fronthend/.env.development](../fronthend/.env.development)
- **Upload failures**: Check `uploads/` directory exists and is writable
- **PDF generation errors**: Puppeteer requires system dependencies on Linux (see Puppeteer docs)

## Adding New Features

### New Entity Type
1. Add table to MySQL with numeric `id` primary key
2. Map in `ENTITY_TABLES` ([server.js](../server.js#L86))
3. Export from [entities.js](../fronthend/src/api/entities.js): `export const MyEntity = makeEntity('MyEntity')`
4. Create page in [fronthend/src/pages/](../fronthend/src/pages/)
5. Add route in [pages/index.jsx](../fronthend/src/pages/index.jsx)
6. Add nav item in [Layout.jsx](../fronthend/src/pages/Layout.jsx) `navigationItems`

### New Page Component
- Must be in [fronthend/src/pages/](../fronthend/src/pages/)
- Use `createPageUrl("PageName")` for routing
- Wrap in `<Layout currentPageName="PageName">` component
- Follow React Query patterns for data fetching
- Use Hindi text for UI labels

### New UI Component
- Check if shadcn/ui version exists: `npx shadcn@latest add <component>`
- Place in [components/ui/](../fronthend/src/components/ui/)
- Import via `@/components/ui/component-name`

## WhatsApp Integration

### Two-Mode System
The app supports two WhatsApp delivery methods ([WhatsAppSettings.jsx](../fronthend/src/pages/WhatsAppSettings.jsx)):

**1. Direct Mode (Browser Link)**
- Opens `wa.me` link in browser with invitation image URL
- No API credentials needed
- Message template stored in `appsettings.whatsapp_direct_message`
- User clicks "Send" in WhatsApp Web/App

**2. API Mode (BHASHSMS)**
- Sends PDF directly via third-party API (BHASHSMS or custom)
- Requires API URL configuration with placeholders
- URL template stored in `appsettings.whatsapp_api_url`
- Supports dynamic placeholder replacement:
  ```
  {{Mob}} → Mobile number
  {{Message}} → Letter content
  {{SenderName}} → Sender name
  {{ProgramType}} → Ceremony type
  {{Sn}} → Serial number
  ```

### Configuration Storage
All settings stored in `appsettings` table:
- `whatsapp_mode`: 'direct' or 'api'
- `whatsapp_api_enabled`: Boolean flag for API mode
- `whatsapp_api_url`: Template URL with placeholders
- `whatsapp_direct_message`: Message text for direct mode

### URL Replacement Logic
API URLs can be in two formats:
1. **With placeholders**: `https://api.example.com/send?phone={{Mob}}&msg={{Message}}`
2. **Static numbers**: `https://api.example.com/send?phone=9876543210` (phone number gets replaced during test)

See [WhatsAppSettings.jsx](../fronthend/src/pages/WhatsAppSettings.jsx#L94-L115) for URL parsing logic.

## Politician Management System

### Three-Module System
Added to manage political workers and automated wishes ([POLITICIAN_FORMS_QUICK_START.md](../POLITICIAN_FORMS_QUICK_START.md)):

**1. Politician Type Master** ([PoliticianTypeMaster.jsx](../fronthend/src/pages/PoliticianTypeMaster.jsx))
- Manage political positions/designations (पदाधिकारी पद मास्टर)
- Examples: अध्यक्ष, महामंत्री, कोषाध्यक्ष

**2. Politician Entry** ([PoliticianEntry.jsx](../fronthend/src/pages/PoliticianEntry.jsx))
- Register political workers with full details
- Fields: Name, Designation, Mobile, Address, Village, Mandal, Booth Number, DOB, Anniversary
- `AutoAllow` flag enables automatic birthday/anniversary wishes
- Search functionality by name/mobile/village

**3. Birthday/Anniversary Wishes** ([BirthdayAnniversaryWishes.jsx](../fronthend/src/pages/BirthdayAnniversaryWishes.jsx))
- Send bulk WhatsApp messages to selected designations
- Auto-send birthday wishes (DOB matches today)
- Auto-send anniversary wishes (DOA matches today)
- Use letter templates with variable replacement: `{{Name}}`, `{{Designation}}`, `{{Village}}`, `{{Mobile}}`

### Automated Wish Scheduler
Server.js includes cron job that runs daily at **13:00 (1:00 PM)**:
- Queries `politician` table for DOB/DOA matches
- Sends WhatsApp wishes to all with `AutoAllow = 1`
- Uses configured WhatsApp API (direct or API mode)
- Logs all sent messages for audit trail

### Mandal System
Separate entity for geographic grouping:
- [MandalMaster.jsx](../fronthend/src/pages/MandalMaster.jsx) for CRUD operations
- Linked to politicians via FK relationship
- Used for filtering and reporting

### Setup Command
Initialize politician tables:
```bash
npm run setup:politicians
```
Runs [create-politician-tables.js](../create-politician-tables.js) to create `politician_type`, `politician`, and `mandal` tables.

## Authentication & Authorization

### Token-Based System
Complete auth implementation (see [AUTHENTICATION_GUIDE.md](../AUTHENTICATION_GUIDE.md)):

**Login Flow:**
1. User enters credentials at [OperatorLogin.jsx](../fronthend/src/pages/OperatorLogin.jsx)
2. Server validates against `operator` table (SHA-256 password hash)
3. Returns JWT token stored in `localStorage` as `operator_token`
4. User data cached as `operator_data` in localStorage
5. [Layout.jsx](../fronthend/src/pages/Layout.jsx) validates token on every page load

**Role-Based Access Control (RBAC):**
- **Admin role** (`role: 'admin'`): Full access to all pages/features
- **Operator role** (`role: 'user'`): Restricted by `page_permissions` JSON array

**Page Permissions:**
Pages stored in `page_permissions` column as JSON array:
```json
["Dashboard", "DataEntry", "ReminderList", "LetterGenerator"]
```
Layout component filters navigation items based on user's allowed pages.

**Feature Permissions:**
Granular controls stored in `permissions` column:
- `can_add_program`, `can_edit_program`, `can_delete_program`
- `can_view_reminder`, `can_mark_attended`
- `can_generate_letter`, `can_resend_letter`
- `can_import_data`

**Session Management:**
- Token expires after inactivity (configured server-side)
- `/api/auth/isAuthenticated` endpoint validates token
- Logout clears localStorage and redirects to login
- Failed auth → automatic redirect to `/OperatorLogin`

**User Management:**
- [UserManagement.jsx](../fronthend/src/pages/UserManagement.jsx): Admin creates/edits operators
- [OperatorManagement.jsx](../fronthend/src/pages/OperatorManagement.jsx): Manage operator permissions
- Password hashing handled server-side (never send plain text)

## PDF Generation

### Puppeteer-Based System
Backend endpoint `/generate-pdf` uses Puppeteer ([server.js](../server.js#L263-L305)):
```javascript
// Accepts HTML string, renders to PDF
POST /generate-pdf
Body: { html: "<html>...</html>" }
Response: PDF file buffer
```

**Puppeteer Configuration:**
- Headless mode: 'new' (required for modern Chromium)
- Launch args: `--no-sandbox`, `--disable-setuid-sandbox` (Linux compatibility)
- Waits for `networkidle0` before rendering (ensures images loaded)
- Output: A4 format with CSS page size preference

**Frontend Usage:**
1. VisualReportDesigner composes HTML from design JSON
2. Sends HTML to `/generate-pdf`
3. Receives PDF blob, triggers browser download
4. Filename: `report-design.pdf`

**System Dependencies:**
- Linux: Requires system libraries (see Puppeteer docs for apt packages)
- Windows: Works out-of-box
- Memory: Can spike for large/complex PDFs

## Base44 SDK Migration

### Historical Context
Project originally built on **Base44 low-code platform** with proprietary SDK. Now migrated to standalone Express + MySQL architecture.

### Legacy Traces
- [base44Client.js](../fronthend/src/api/base44Client.js): Compatibility stub (delete-safe)
- `VITE_BASE44_API_URL` env var: Now points to local Express server
- Mock server references: Base44 envelope shapes (`{data: [], success: true}`)

### Current State
- **restClient.js** replaces Base44 SDK entirely
- Tries multiple endpoint patterns for compatibility:
  ```javascript
  /api/entities/${entity}        // Primary
  /api/entities/${entity}/list   // Alternative
  /api/${entity.toLowerCase()}   // Fallback
  ```
- **entities.js** provides wrapper functions mimicking old SDK API
- No external dependencies on Base44 services

### Migration Pattern
When encountering Base44 references:
1. Replace SDK calls with `restClient.listEntities()`, etc.
2. Update entity names to match `ENTITY_TABLES` mapping
3. Remove `base44` imports
4. Test with local MySQL backend

## Database Schema

### Core Tables

**pragram** (main entity - note lowercase, missing 'o')
```sql
id INT PRIMARY KEY AUTO_INCREMENT
Sn INT                          -- Serial number (~6000+)
SenderName VARCHAR              -- प्रेषक का नाम
Mob VARCHAR(10)                 -- Mobile number
Street VARCHAR                  -- मोहल्ला/गली
Village VARCHAR                 -- गाँव/शहर
District VARCHAR                -- जिला
Date DATE                       -- Program date
programtyp INT                  -- FK to programtype.id
ProgramFor VARCHAR              -- Ceremony for whom
Relation_to_sender VARCHAR      -- Relation to sender
place_time VARCHAR              -- Place and time
event_time TIME                 -- Event time
LocalProgram VARCHAR            -- Local ceremony details
detail TEXT                     -- Additional details
Joint BOOLEAN                   -- Joint invitation
bulk BOOLEAN                    -- Bulk invitation
prafull BOOLEAN                 -- Prafull flag
Attended BOOLEAN                -- Attended flag
sended BOOLEAN                  -- Letter sent flag
```

**programtype** (ceremony types)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
Programtyp VARCHAR              -- Display name (विवाह, गृहप्रवेश, etc.)
```

**lettersettings** (page layout config)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
page_size VARCHAR(10)           -- 'A4', 'Letter', 'Legal'
page_width DECIMAL(10,2)        -- mm
page_height DECIMAL(10,2)       -- mm
margin_top DECIMAL(10,2)        -- mm
margin_bottom DECIMAL(10,2)
margin_left DECIMAL(10,2)
margin_right DECIMAL(10,2)
letterhead_url VARCHAR          -- /uploads/filename.png
signature_url VARCHAR
letterhead_top_margin DECIMAL(10,2)
letterhead_height DECIMAL(10,2)
signature_right_margin DECIMAL(10,2)
signature_bottom_margin DECIMAL(10,2)
signature_height DECIMAL(10,2)
design_template TEXT            -- JSON for visual designer
```

**lettertemplate** (letter content templates)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
name VARCHAR                    -- Template name
body TEXT                       -- Letter content with placeholders
```

**appsettings** (global settings)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
whatsapp_api_url TEXT
whatsapp_api_enabled BOOLEAN
whatsapp_mode VARCHAR(10)       -- 'direct' or 'api'
whatsapp_direct_message TEXT
```

**operator** (user/operator management)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
name VARCHAR
username VARCHAR
password_hash VARCHAR           -- Hashed password (SHA-256)
role VARCHAR                    -- 'admin', 'operator', etc.
is_active TINYINT(1)            -- Account active status
email VARCHAR                   -- Login email (unique)
permissions LONGTEXT            -- JSON array of feature permissions
page_permissions LONGTEXT       -- JSON array of accessible pages
last_login DATETIME
created_date DATETIME
updated_date DATETIME
```

**politician_type** (political positions/designations)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
Designation VARCHAR             -- पद name (अध्यक्ष, महामंत्री, etc.)
```

**politician** (political workers registry)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
Name VARCHAR                    -- Full name
PoliticianType INT              -- FK to politician_type.id
Mobile VARCHAR(10)              -- Contact number
Address VARCHAR
Village VARCHAR                 -- गाँव/शहर
Mandal INT                      -- FK to mandal.id
BoothNo VARCHAR                 -- बूथ नंबर
DOB DATE                        -- Date of birth
DOA DATE                        -- Date of anniversary
AutoAllow BOOLEAN               -- Enable auto birthday/anniversary wishes
```

**mandal** (mandal/block management)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
Name VARCHAR                    -- Mandal name
```

### Schema Evolution Pattern
1. Write script like `update-lettersettings-schema.js`
2. Check if columns exist before ALTER TABLE
3. Use `.env` credentials via `dotenv`
4. Log each operation for audit trail
5. Show before/after schema with `SHOW COLUMNS`

Example pattern:
```javascript
const [columns] = await connection.query('SHOW COLUMNS FROM table');
const exists = columns.some(col => col.Field === 'new_column');
if (!exists) {
  await connection.query('ALTER TABLE table ADD COLUMN new_column TYPE');
}
```

## Testing Strategy

### Manual Testing Approach
No automated test suite currently. Testing relies on:

**Development Server Testing:**
1. Start backend: `npm run api` (check console for DB connection)
2. Start frontend: `npm run frontend:dev`
3. Test CRUD operations via UI
4. Check browser console for errors
5. Verify API responses in Network tab

**Database Verification Scripts:**
- `node check-program-data.js`: Inspect Pragram records, detect large fields
- `node check-lettersettings.js`: Validate letter settings, find corrupted JSON
- `node clean-lettersettings.js`: Remove invalid records
- `node test-db.js`: Test MySQL connection, list databases/tables

**Common Test Scenarios:**
1. **Create new invitation**: Verify auto-increment Sn, all fields save
2. **Edit existing**: Search by Sn/name, update, confirm changes persist
3. **Upload images**: Check `uploads/` directory, verify URL in database
4. **Generate PDF**: Test visual designer export, open PDF
5. **WhatsApp test**: Use test button in settings, verify redirect/API call

**Debugging Patterns:**
- Add `console.log` liberally (not production-ready)
- Check server.js console for API errors
- Use `JSON.stringify(data, null, 2)` for readable logs
- Verify MySQL queries directly via CLI for data issues

**Data Integrity Checks:**
- Search large fields: `SELECT * FROM pragram WHERE LENGTH(detail) > 1000`
- Verify foreign keys: Check programtyp values exist in programtype table
- Find orphaned records: Missing required fields like Sn, SenderName

## Code Examples

### Adding a New Form Field

**1. Update Database Schema:**
```javascript
// update-schema.js
const [columns] = await connection.query('SHOW COLUMNS FROM pragram');
if (!columns.some(col => col.Field === 'new_field')) {
  await connection.query('ALTER TABLE pragram ADD COLUMN new_field VARCHAR(255)');
}
```

**2. Add to ProgramForm Component:**
```jsx
// ProgramForm.jsx - Add to initialFormData
const initialFormData = {
  // ... existing fields
  new_field: initialData?.new_field || '',
};

// Add form field in render
<div className="space-y-2">
  <Label htmlFor="new_field" className="text-sm font-semibold text-gray-700">
    नया फ़ील्ड <span className="text-red-500">*</span>
  </Label>
  <Input
    id="new_field"
    value={formData.new_field}
    onChange={(e) => handleChange('new_field', e.target.value)}
    placeholder="नया फ़ील्ड दर्ज करें"
    className={cn(errors.new_field && "border-red-500")}
  />
  {errors.new_field && <p className="text-xs text-red-500">{errors.new_field}</p>}
</div>
```

**3. Add Validation (Optional):**
```jsx
const validateForm = () => {
  const newErrors = {};
  if (!formData.new_field?.trim()) {
    newErrors.new_field = "यह फ़ील्ड आवश्यक है";
  }
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### Adding a New API Endpoint

**1. Define in server.js:**
```javascript
// server.js
app.post('/api/custom-action', async (req, res) => {
  try {
    const { param1, param2 } = req.body;
    const [result] = await pool.query(
      'SELECT * FROM pragram WHERE Sn = ?',
      [param1]
    );
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

**2. Call from Frontend:**
```jsx
// In component
const performAction = async (data) => {
  const response = await fetch('/api/custom-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await response.json();
};

// With React Query
const actionMutation = useMutation({
  mutationFn: (data) => performAction(data),
  onSuccess: (result) => {
    toast.success("सफलतापूर्वक पूर्ण!");
    queryClient.invalidateQueries({ queryKey: ['programs'] });
  },
});
```

### Adding a New Entity

**1. Create table in MySQL:**
```sql
CREATE TABLE mytable (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**2. Register in ENTITY_TABLES:**
```javascript
// server.js
const ENTITY_TABLES = {
  // ... existing
  MyEntity: 'mytable',
};
```

**3. Export from entities.js:**
```javascript
// fronthend/src/api/entities.js
export const MyEntity = makeEntity('MyEntity');
```

**4. Create page component:**
```jsx
// fronthend/src/pages/MyEntityManager.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import restClient from '@/api/restClient';

export default function MyEntityManager() {
  const queryClient = useQueryClient();
  
  const { data: items = [] } = useQuery({
    queryKey: ['my-entity'],
    queryFn: () => restClient.listEntities('MyEntity'),
  });
  
  const createMutation = useMutation({
    mutationFn: (data) => restClient.createEntity('MyEntity', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entity'] });
      toast.success("जोड़ा गया!");
    },
  });
  
  // ... render UI
}
```

**5. Add route in pages/index.jsx:**
```jsx
import MyEntityManager from './MyEntityManager';

const pageComponents = {
  // ... existing
  MyEntityManager,
};
```

**6. Add nav item in Layout.jsx:**
```jsx
const navigationItems = [
  // ... existing
  {
    title: "मेरी एंटिटी",
    url: createPageUrl("MyEntityManager"),
    icon: Settings,
  },
];
```

### Handling Hindi Text Input

**Standard Pattern:**
```jsx
// Always use Devanagari for labels and messages
<Label>प्रेषक का नाम</Label>

// Toast messages in Hindi
toast.success("सफलतापूर्वक जोड़ा गया!");
toast.error("त्रुटि: निमंत्रण जोड़ने में विफल");

// Placeholders in Hindi
<Input placeholder="प्रेषक का नाम दर्ज करें" />

// Badge text
<Badge>विवाह</Badge>
```

**Font Handling:**
Use Noto Sans Devanagari for proper rendering (already configured in CSS).

## References
- [SETUP_VISUAL_DESIGNER.md](../SETUP_VISUAL_DESIGNER.md) - Visual designer implementation guide
- [VISUAL_DESIGNER_README.md](../VISUAL_DESIGNER_README.md) - Visual designer user docs
- [AUTHENTICATION_GUIDE.md](../AUTHENTICATION_GUIDE.md) - Complete auth/authorization documentation
- [POLITICIAN_FORMS_QUICK_START.md](../POLITICIAN_FORMS_QUICK_START.md) - Politician system quick start
- [POLITICIAN_FORMS_IMPLEMENTATION.md](../POLITICIAN_FORMS_IMPLEMENTATION.md) - Technical implementation details
- [fronthend/README.md](../fronthend/README.md) - Frontend build/run commands
