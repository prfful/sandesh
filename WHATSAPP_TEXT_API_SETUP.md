# WhatsApp Bulk Text API Setup Guide

## ✅ Problem Fixed!

**Previous Error:** `Only Utility or Authentication Templates Supported/SplitCredits Not Activated`

**Root Cause:** BHASHSMS has TWO different template types:
1. **UTILITY Template** - For sending PDF documents (invitation letters)
2. **TEXT Template** - For sending plain text messages (birthday/anniversary wishes)

You were trying to use UTILITY API for TEXT messages, which caused the error.

---

## 🎯 Solution: Separate API Configuration

We've now separated the APIs into two independent systems:

### 📄 PDF API (UTILITY Template)
- **Purpose:** Send invitation PDF letters
- **Used in:** Letter Generator page
- **Settings:** `whatsapp_pdf_api_url`, `whatsapp_pdf_api_enabled`
- **Status:** ✅ Already working properly

### 💬 TEXT API (TEXT Template)  
- **Purpose:** Send bulk text messages (birthday/anniversary)
- **Used in:** Birthday/Anniversary Wishes page
- **Settings:** `whatsapp_text_api_url`, `whatsapp_text_template_name`, `whatsapp_text_api_enabled`
- **Status:** ✅ Now properly configured

---

## 📋 Deployment Steps

### Step 1: Update Database Schema

**Option A: Run SQL Script (Recommended)**

1. Open phpMyAdmin on Hostinger
2. Select `u590837060_sandesh_data` database
3. Go to **SQL** tab
4. Copy and paste from [add-text-whatsapp-api.sql](add-text-whatsapp-api.sql)
5. Click **Execute**

**Option B: Run Node.js Script**
```bash
node add-text-whatsapp-columns.js
```

**What this does:**
- Adds `whatsapp_text_api_url` column
- Adds `whatsapp_text_template_name` column
- Adds `whatsapp_text_api_enabled` column
- Renames `whatsapp_api_url` → `whatsapp_pdf_api_url` (backward compatible)
- Renames `whatsapp_api_enabled` → `whatsapp_pdf_api_enabled`

---

### Step 2: Deploy Updated Code to Hostinger

Follow the [HOSTINGER_DEPLOYMENT_GUIDE.md](HOSTINGER_DEPLOYMENT_GUIDE.md):

1. **Go to Hostinger hPanel → Git**
2. Click **"Pull"** to deploy latest code from GitHub
3. **SSH into server** and run:
   ```bash
   cd /home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html
   npm install --production
   touch tmp/restart.txt
   ```
4. **Restart application** (Passenger will auto-restart on file change)

---

### Step 3: Configure TEXT API in WhatsApp Settings

1. **Open Sandesh Website:** https://seagreen-woodcock-382393.hostingersite.com/
2. **Go to:** WhatsApp सेटिंग्स (WhatsApp Settings)
3. **Select:** बल्क WhatsApp API (BHASHSMS) mode

You'll now see **TWO separate sections**:

#### 📄 PDF API Configuration (Already working)
- ✅ Keep your existing UTILITY API URL
- Example:
  ```
  https://bhashsms.com/api/sendmsgutil.php?user=dharfc_bwa&pass=XXX&sender=BUZWAP&phone={{Mob}}&text={{Message}}&htype=document&url={{PdfUrl}}
  ```

#### 💬 TEXT API Configuration (New - Configure this!)
1. **Enable:** Check "TEXT WhatsApp API सक्षम करें"
2. **Template Name:** Enter your TEXT template name from BHASHSMS
   ```
   team_neenavverma_01
   ```
   OR
   ```
   teamneenavverma
   ```
3. **TEXT API URL:** Paste your TEXT API URL from BHASHSMS
   ```
   https://bhashsms.com/api/sendmsg.php?user=dharfc_bwa&pass=XXX&sender=BUZWAP&phone={{Mob}}&text={{Message}}&template_id=team_neenavverma_01
   ```

4. **Click "सहेजें" (Save)**

---

### Step 4: Test TEXT API

**In WhatsApp Settings page:**

1. Scroll to **🧪 TEXT API टेस्ट करें** section
2. Enter your **mobile number** (10 digits)
3. Click **"टेस्ट TEXT API URL खोलें"**
4. A new browser tab will open with the API test URL
5. Check if you receive the test message on WhatsApp

**Expected Result:**
- ✅ Message delivered successfully
- ✅ No "Only Utility Templates Supported" error

---

## 🔍 How to Get Your TEXT API from BHASHSMS

Based on your screenshot, you have these TEXT templates:
- `team_neenavverma_01` (UTILITY)
- `teamneenavverma` (MARKETING, TEXT)

### Steps to Get TEXT API URL:

1. **Login to BHASHSMS:** https://bhashsms.com/
2. **Go to:** Templates WA → Add WA Templates
3. **Find your TEXT template** (like `teamneenavverma`)
4. **Click on template** to see API URL
5. **Copy the TEXT API URL** (should NOT have `htype=document` parameter)

**Example TEXT API format:**
```
https://bhashsms.com/api/sendmsg.php?user=dharfc_bwa&pass=YOUR_PASSWORD&sender=BUZWAP&phone={{Mob}}&text={{Message}}&template_id=teamneenavverma
```

**Key Differences from PDF API:**
- ❌ NO `htype=document` parameter
- ❌ NO `url={{PdfUrl}}` parameter
- ❌ NO `fname=` parameter
- ✅ Uses `sendmsg.php` (not `sendmsgutil.php`)
- ✅ Has `template_id=` parameter

---

## 📱 Using Birthday/Anniversary Wishes

**After configuring TEXT API:**

1. **Go to:** जन्मदिन/वर्षगांठ बधाई पत्र भेजें (Birthday/Anniversary Wishes)
2. **Select Type:** जन्मदिन बधाई or वर्षगांठ बधाई
3. **Choose Designations:** Select which political worker types
4. **Select Template:** Choose birthday or anniversary template
5. **Click "भेजें"** to send bulk messages

**What happens:**
- System finds all politicians with DOB/DOA matching today
- Uses your **TEXT API** (not PDF API)
- Sends text messages to all selected people
- Logs all sent messages in database

---

## 🐛 Troubleshooting

### Issue: TEXT API still shows "Only Utility Templates Supported"

**Solution:**
1. Make sure you're using **TEXT template API**, not UTILITY API
2. TEXT API should use `sendmsg.php` endpoint
3. Remove any `htype=document` parameters from TEXT API URL
4. Verify template name matches BHASHSMS dashboard

### Issue: "WhatsApp TEXT API not configured"

**Solution:**
1. Go to WhatsApp Settings
2. Make sure **"TEXT WhatsApp API सक्षम करें"** is checked
3. Enter valid TEXT API URL
4. Click "सहेजें" to save

### Issue: Messages not received

**Solution:**
1. Test with debug mode first (check "TEXT API डिबग मोड")
2. Verify phone numbers are in correct format (10 digits)
3. Check BHASHSMS balance
4. Verify template is approved in BHASHSMS

### Issue: Database columns not found error

**Solution:**
1. Run the SQL script: [add-text-whatsapp-api.sql](add-text-whatsapp-api.sql)
2. Check columns exist in `appsettings` table:
   ```sql
   SHOW COLUMNS FROM appsettings WHERE Field LIKE '%whatsapp%';
   ```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    WhatsApp Settings                     │
│                                                          │
│  ┌────────────────────┐    ┌──────────────────────┐    │
│  │   📄 PDF API       │    │   💬 TEXT API         │    │
│  │  (UTILITY)         │    │   (TEXT)              │    │
│  │                    │    │                       │    │
│  │ • sendmsgutil.php  │    │ • sendmsg.php         │    │
│  │ • htype=document   │    │ • template_id=XXX     │    │
│  │ • url={{PdfUrl}}   │    │ • Plain text only     │    │
│  └────────────────────┘    └──────────────────────┘    │
│         ↓                           ↓                   │
│  Letter Generator          Birthday/Anniversary         │
│  (Send PDF invites)        (Bulk text messages)         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Database columns added successfully
- [ ] Backend restarted (server.js using new columns)
- [ ] Frontend updated (new WhatsApp Settings UI)
- [ ] PDF API still works (Letter Generator)
- [ ] TEXT API configured with template name
- [ ] TEXT API tested and receiving messages
- [ ] Birthday/Anniversary page uses TEXT API
- [ ] No more "Only Utility Templates Supported" error

---

## 📞 Support

**Files Changed:**
- [server.js](server.js) - Backend API endpoints
- [fronthend/src/pages/WhatsAppSettings.jsx](fronthend/src/pages/WhatsAppSettings.jsx) - Settings UI
- [fronthend/src/pages/BirthdayAnniversaryWishes.jsx](fronthend/src/pages/BirthdayAnniversaryWishes.jsx) - Bulk messaging
- [fronthend/src/pages/LetterGenerator.jsx](fronthend/src/pages/LetterGenerator.jsx) - PDF sending
- [add-text-whatsapp-api.sql](add-text-whatsapp-api.sql) - Database migration

**Git Repository:** https://github.com/prfful/sandesh-invitation-manager

---

**Last Updated:** February 24, 2026  
**Status:** ✅ Ready for Production Deployment
