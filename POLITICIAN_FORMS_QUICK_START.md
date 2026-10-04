# 🎉 Politician Management System - Quick Start Guide

## ✅ What's New

Three complete forms have been added to your Sandesh project:

### 1. **पदाधिकारी पद मास्टर** (Politician Type Master)
   - Manage political positions/designations
   - Add, edit, delete designations
   - Example: अध्यक्ष, महामंत्री, कोषाध्यक्ष, etc.

### 2. **कार्यकर्ता / पदाधिकारी इंद्राज** (Politician Entry)
   - Register all political workers and officers
   - Complete information: name, position, mobile, address, village, booth number, DOB, anniversary
   - Auto-allow flag for automatic wishes
   - Search by name/mobile/village

### 3. **व्हाट्सएप संदेश भेजें** (WhatsApp Bulk Message)
   - Send bulk WhatsApp messages to selected designations
   - Send birthday wishes to today's birthdays
   - Send anniversary wishes to today's anniversaries
   - Use templates from LetterTemplate library
   - Variable replacement: {{Name}}, {{Designation}}, {{Village}}, {{Block}}, {{Mobile}}

---

## 🚀 Quick Start (2 minutes)

### Step 1: Initialize Database
```bash
npm run setup:politicians
```

### Step 2: Start API Server (Terminal 1)
```bash
npm run api
```
Expected output:
```
✅ Database connected successfully!
AutoWishes scheduler started
API server listening on http://localhost:3000
```

### Step 3: Start Frontend (Terminal 2)
```bash
npm run frontend:dev
```

### Step 4: Open Browser
```
http://localhost:5173
```

---

## 📍 Where to Find the Forms

### In Sidebar (Left Panel):
**पार्टी कार्यकर्ता प्रबंधन** (Section with purple styling)

```
├── पदाधिकारी पद मास्टर (Politician Type Master)
├── कार्यकर्ता / पदाधिकारी इंद्राज (Politician Entry)
└── WhatsApp बल्क संदेश (WhatsApp Bulk)
```

---

## 📋 Form Fields Reference

### Politician Type Form
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Designation | Text | Yes | पद का नाम (e.g., अध्यक्ष) |

### Politician Entry Form
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | पूरा नाम |
| Designation | Dropdown | Yes | Select from Politician Type Master |
| Mobile | Number | Yes | 10 digits only |
| Address | Text | No | पता |
| Area | Radio | No | ग्रामीण (Rural) or नगरीय (Urban) |
| Village/City | Text | No | गाँव/नगर का नाम |
| Block | Text | No | विकासखंड का नाम |
| DOB | Date | No | जन्म तारीख |
| DOA | Date | No | विवाह वर्षगांठ |
| Booth No | Number | No | मतदान केंद्र क्रमांक |
| Auto Allow | Checkbox | No | For automatic birthday/anniversary wishes |

---

## 💬 WhatsApp Integration

### Bulk Message Tab
1. Select one or more designations from left panel
2. Politicians with that designation appear in middle panel
3. Check/uncheck individuals you want to message
4. Type your message (use placeholders for personalization)
5. Click "संदेश भेजें" button

**Available Placeholders:**
- `{{Name}}` → Worker's full name
- `{{Designation}}` → Their position
- `{{Village}}` → Village/City name
- `{{Block}}` → Block name
- `{{Mobile}}` → Mobile number

**Example Message:**
```
नमस्ते {{Name}},

आप {{Designation}} के रूप में {{Village}} में हमारे पार्टी के मूल्यवान सदस्य हैं।

आपके मतदान केंद्र पर आपकी सेवा के लिए धन्यवाद।

🙏 {{Name}}
```

### Birthday & Anniversary Tab
1. **Today's Birthday List** automatically shows all birthdays today (if AutoAllow = Yes)
2. **Today's Anniversary List** automatically shows all anniversaries today (if AutoAllow = Yes)
3. Select a template or write custom message
4. Click respective button to send wishes

---

## 🗄️ Database Structure

### politician_type Table
```
id (Primary Key) | Designation
1                | अध्यक्ष
2                | महामंत्री
3                | कोषाध्यक्ष
...
```

### politician Table
```
id | Name | Designation | Mobile | Address | Area | Village_City | Block | DOB | DOA | Booth_No | AutoAllow
```

### whatsapp_log Table
```
id | person_id | type | message | status | response | sent_at
```
(Tracks all WhatsApp delivery - useful for audit trail)

---

## ⚙️ Configuration

### WhatsApp Mode Settings
Check **WhatsApp सेटिंग्स** page:
- **Direct Mode:** Opens wa.me link in browser
- **API Mode:** Sends via configured Bulk WhatsApp API (e.g., BhashSMS)

### Automatic Daily Wishes (1:00 PM)
Server automatically sends birthday & anniversary wishes every day at **13:00 (1:00 PM)** for all politicians with:
- `AutoAllow = 1` (Yes)
- DOB or DOA matching today's date

Check **whatsapp_log** table for delivery status

---

## 🔍 Search & Filter

### Politician Entry Search
Type in search box:
- **By Name:** "राज" (partial name)
- **By Mobile:** "9876543210" (full 10 digits)
- **By Village:** "बड़ागाँव" (village name)

Search is case-insensitive and shows up to 10 results

---

## ✨ Key Features

✅ **Full CRUD Operations** - Create, Read, Update, Delete
✅ **Data Validation** - Mobile numbers must be 10 digits
✅ **Search Capability** - Quick lookup by name/mobile/village
✅ **Hindi Interface** - Complete Devanagari text support
✅ **Template Support** - Use saved letter templates
✅ **Auto-Wishes** - Automatic birthday/anniversary messages daily
✅ **Delivery Logging** - Track all WhatsApp sends
✅ **Responsive Design** - Works on desktop & mobile
✅ **User Feedback** - Toast notifications for all actions

---

## 🐛 Troubleshooting

### Forms not showing?
1. Verify server is running: `npm run api`
2. Check database tables: `npm run setup:politicians`
3. Refresh browser (Ctrl+F5)

### WhatsApp messages not sending?
1. Check **WhatsApp सेटिंग्स** configuration
2. Verify mobile numbers are 10 digits
3. Check **whatsapp_log** table for error messages

### Database connection error?
1. Ensure MySQL is running
2. Check `.env` file credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=sandesh_data
   ```

---

## 📞 Support

If you encounter issues:
1. Check the console for error messages
2. Look at API server logs (Terminal 1)
3. Check frontend console (Browser DevTools → Console)
4. Verify database tables exist: `npm run setup:politicians`

---

## 🎯 Next Steps

1. ✅ Add politician types (पद)
2. ✅ Add politician/worker records
3. ✅ Set AutoAllow = Yes for birthday/anniversary wishes
4. ✅ Configure WhatsApp settings
5. ✅ Send test messages
6. ✅ Monitor delivery in whatsapp_log table

---

**Happy campaigning! 🇮🇳**
