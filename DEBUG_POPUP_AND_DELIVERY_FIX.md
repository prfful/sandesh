# WhatsApp TEXT API - Debug Popup & Message Delivery Fix 🔧

## Issues Reported

1. **Messages queueing but NOT delivering** ❌
   - Console shows: `bhashResponse: 'S.412262'`, `'S.360169'`, `'S.868287'`, etc.
   - Status 200 (success) but messages never reach recipients
   
2. **Debug popup NOT showing** ❌
   - You enabled "TEXT API डिबग मोड" in WhatsApp Settings
   - But popup window doesn't appear when sending bulk messages

---

## Root Cause Analysis

### Problem 1: Messages Queue But Don't Deliver
**Cause:** `template_id` parameter is **MISSING** from API calls

BHASHSMS TEXT API requires **EXACT** URL format:
```
https://bhashsms.com/api/sendmsg.php?user=XXX&pass=XXX&sender=BUZWAP&phone=9876543210&text=Message&template_id=teamneenavverma
                                                                                                               ^^^^^^^^^^^^^^^^^
                                                                                                               THIS IS REQUIRED!
```

**Without `template_id`:**
- ✅ BHASHSMS accepts request (Status 200)
- ✅ Message gets queued (S.412262, etc.)
- ❌ Message **NEVER delivers** becausetemplate validation fails

### Problem 2: Debug Popup Not Showing
**Possible causes:**
1. Debug mode not enabled in database
2. Template Name field empty in database
3. TEXT API not enabled in database
4. appSettings not loading properly

---

## Fixes Applied (Already in GitHub)

### 1. Server.js - Template ID Support ✅
**File:** [server.js](server.js) (Lines 1003, 1020-1051)

**What it does:**
- Reads `whatsapp_text_template_name` from appsettings table
- Adds `template_id=` parameter to all TEXT API calls
- Handles both URL parsing and fallback modes

### 2. Debug URLs - Template ID Support ✅
**File:** [fronthend/src/pages/BirthdayAnniversaryWishes.jsx](fronthend/src/pages/BirthdayAnniversaryWishes.jsx)

**What changed:**
- Debug URLs now include `template_id` parameter (matching server behavior)
- Added console logging to diagnose debug mode issues
- Shows **warning banner** if `template_id` is missing from URLs

### 3. Verification Scripts ✅
**Files:** 
- [check-template-id-config.js](check-template-id-config.js) - Check database configuration
- [verify-text-api-setup.js](verify-text-api-setup.js) - Complete setup verification

---

## How to Fix (Step-by-Step)

### **Step 1: Deploy Updated Code to Hostinger**

```bash
ssh -p 65002 u590837060@145.79.211.22
cd ~/domains/seagreen-woodcock-382393.hostingersite.com/nodejs
git pull origin main
touch tmp/restart.txt
exit
```

**What this does:**
- Pulls latest code with template_id support
- Restarts Node.js server to apply changes

---

### **Step 2: Configure Template Name in Database**

**Option A: Via Web Interface (Recommended)**

1. Login to your app: https://seagreen-woodcock-382393.hostingersite.com
2. Go to **WhatsApp Settings** page
3. Find **"TEXT API सेटिंग्स"** section
4. **⚠️ CRITICAL:** Fill in **"Template Name"** field
   - Example: `teamneenavverma` or `team_neenavverma_01`
   - This should match your BHASHSMS template exactly
5. Enable **"TEXT API डिबग मोड"** checkbox (for popup)
6. Click **"सहेजें" (Save)**

**Option B: Direct Database Update (If web interface not working)**

```sql
-- SSH into Hostinger, run MySQL:
mysql -h localhost -u u590837060_sandeshuser -p u590837060_sandesh_data

-- Check current settings:
SELECT whatsapp_text_api_enabled, whatsapp_text_template_name, whatsapp_text_debug_prompt FROM appsettings;

-- Update template name (replace 'teamneenavverma' with YOUR template):
UPDATE appsettings SET 
  whatsapp_text_template_name = 'teamneenavverma',
  whatsapp_text_debug_prompt = 1
WHERE id = 1;

-- Verify:
SELECT whatsapp_text_template_name, whatsapp_text_debug_prompt FROM appsettings;
EXIT;
```

---

### **Step 3: Verify Configuration**

**Check Console Logs:**

When you click **"संदेश भेजें"** in Birthday/Anniversary Wishes page, browser console should show:

```javascript
🔍 Debug Check: {
  debug_enabled: true,          // ✅ Should be true
  api_enabled: true,            // ✅ Should be true
  api_url_set: true,            // ✅ Should be true
  template_name: "teamneenavverma"  // ✅ Should show your template name
}
```

**If debug popup STILL doesn't show:**
- Check that all 4 values above are true/set
- Refresh page (Ctrl + F5)
- Clear browser cache
- Check server logs for errors

---

### **Step 4: Test Debug Popup**

1. Go to **Birthday/Anniversary Wishes** page
2. Select some recipients
3. Choose template
4. Click **"संदेश भेजें"**
5. **✅ Popup should appear** with title "🔍 WhatsApp API डिबग URLs"

**What to look for in popup:**

**✅ GOOD - URL has template_id:**
```
https://bhashsms.com/api/sendmsg.php?...&template_id=teamneenavverma
```

**❌ BAD - Missing template_id:**
```
https://bhashsms.com/api/sendmsg.php?...&phone=9876543210&text=Message
(No template_id parameter!)
```

If missing, you'll see **yellow warning banner** in popup:
```
⚠️ Template ID गायब है!
URLs में template_id parameter नहीं है। 
संदेश queue होंगे लेकिन deliver नहीं होंगे।
```

---

### **Step 5: Test Actual Message Delivery**

**After confirming template_id is in debug URLs:**

1. **Disable debug mode temporarily** (uncheck in WhatsApp Settings)
2. Send ONE test message to your own mobile number
3. Check server logs for:
   ```
   Final Text Message API URL: ...&template_id=teamneenavverma
   ```
4. **✅ Message should DELIVER** (not just queue)
5. Check BHASHSMS dashboard for delivery confirmation

---

## Troubleshooting Guide

### Issue: Debug Popup Still Not Showing

**Check 1: Database Values**
```bash
ssh -p 65002 u590837060@145.79.211.22
cd ~/domains/seagreen-woodcock-382393.hostingersite.com/nodejs
mysql -h localhost -u u590837060_sandeshuser -pxK9mP2vL8qR5wN7 u590837060_sandesh_data -e "SELECT whatsapp_text_api_enabled, whatsapp_text_debug_prompt, whatsapp_text_template_name FROM appsettings"
```

Expected output:
```
+---------------------------+---------------------------+------------------------------+
| whatsapp_text_api_enabled | whatsapp_text_debug_prompt| whatsapp_text_template_name  |
+---------------------------+---------------------------+------------------------------+
|                         1 |                         1 | teamneenavverma              |
+---------------------------+---------------------------+------------------------------+
```

**Check 2: Browser Console**
Look for this log when clicking "संदेश भेजें":
```
🔍 Debug Check: { debug_enabled: true, ... }
```

If `debug_enabled: false`, database value is wrong or appSettings not loading.

**Check 3: Code Deployment**
Verify server has latest code:
```bash
ssh -p 65002 u590837060@145.79.211.22
cd ~/domains/seagreen-woodcock-382393.hostingersite.com/nodejs
git log --oneline -5
```

Should show recent commits:
```
c266fa5 Fix: Add template_id to debug URLs and show warning if missing
60c7bc4 Fix: Add template_id parameter to WhatsApp TEXT API bulk sends
```

---

### Issue: Messages Still Queueingbut Not Delivering

**Check 1: Server Logs**
```bash
ssh -p 65002 u590837060@145.79.211.22
tail -f ~/domains/seagreen-woodcock-382393.hostingersite.com/nodejs/logs/app.log
```

Look for:
```
Final Text Message API URL: https://bhashsms.com/api/sendmsg.php?...&template_id=teamneenavverma
```

**✅ If present:** Template ID is being added correctly

**❌ If missing:** Check that:
1. `whatsapp_text_template_name` column exists in appsettings table
2. Template name is saved in database
3. Server was restarted after code update (`touch tmp/restart.txt`)

**Check 2: BHASHSMS Template Status**

1. Login to BHASHSMS: https://bhashsms.com/
2. Go to **Templates WA** → **Add WA Templates**
3. Find your template (e.g., `teamneenavverma`)
4. Check status: **MUST be APPROVED** (not PENDING or REJECTED)
5. Verify template name exactly matches what's in your database

**Check 3: Template Name Mismatch**

Common mistakes:
- Database: `teamneenavverma`
- BHASHSMS: `team_neenavverma_01` ❌
- Result: API calls fail, messages queue but don't deliver

**Fix:** Update database to match EXACTLY:
```sql
UPDATE appsettings SET whatsapp_text_template_name = 'team_neenavverma_01';
```

---

### Issue: Column `whatsapp_text_template_name` Doesn't Exist

**Check if column exists:**
```bash
ssh -p 65002 u590837060@145.79.211.22
mysql -h localhost -u u590837060_sandeshuser -pxK9mP2vL8qR5wN7 u590837060_sandesh_data -e "SHOW COLUMNS FROM appsettings LIKE 'whatsapp_text%'"
```

**If empty output, add column:**
```sql
ALTER TABLE appsettings ADD COLUMN whatsapp_text_template_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE appsettings ADD COLUMN whatsapp_text_debug_prompt TINYINT(1) DEFAULT 0;
```

---

## Complete Verification Checklist

Run through this before testing:

- [ ] Code deployed to Hostinger (`git pull origin main` done)
- [ ] Server restarted (`touch tmp/restart.txt` done)
- [ ] `whatsapp_text_template_name` column exists in appsettings table
- [ ] Template name saved in database (e.g., `teamneenavverma`)
- [ ] Template name matches BHASHSMS exactly (case-sensitive!)
- [ ] Debug mode enabled (`whatsapp_text_debug_prompt = 1`)
- [ ] BHASHSMS template status is APPROVED
- [ ] Browser cache cleared (Ctrl + Shift + Del)
- [ ] Page refreshed (Ctrl + F5)

---

## Quick Test Script

Use this to verify everything:

```bash
# On your local machine:
node check-template-id-config.js
```

This script will:
- ✅ Check if required columns exist
- ✅ Show current configuration values
- ✅ Identify missing settings
- ✅ Provide specific fix instructions

---

## Expected Behavior After Fix

### When Debug Mode is ENABLED:

1. Click **"संदेश भेजें"** in Birthday/Anniversary Wishes
2. **✅ Popup appears** with URLs for each recipient
3. **✅ Each URL includes `template_id=teamneenavverma`**
4. **✅ No yellow warning banner** (if template_id present)
5. **❌ Messages are NOT sent** (debug mode only shows URLs)

### When Debug Mode is DISABLED:

1. Click **"संदेश भेजें"**
2. **❌ No popup** (goes directly to sending)
3. **✅ Messages sent via backend** server.js endpoint
4. **✅ Console shows:** `Status: 200, bhashResponse: 'S.XXXXXX'`
5. **✅ Messages DELIVER to recipients** (not just queue)
6. **✅ Server logs show:** `Final Text Message API URL: ...&template_id=teamneenavverma`

---

## Summary

**What was broken:**
1. Debug URLs didn't include `template_id` parameter
2. No visual warning when `template_id` was missing
3. No logging to diagnose why popup wasn't showing

**What we fixed:**
1. ✅ Debug URLs now include `template_id` (matching server behavior)
2. ✅ Yellow warning banner shows if `template_id` missing
3. ✅ Console logs help diagnose debug mode issues
4. ✅ Server.js adds `template_id` from database (previous fix)

**What you need to do:**
1. Deploy updated code to Hostinger
2. **Configure Template Name in WhatsApp Settings** (CRITICAL!)
3. Enable debug mode checkbox
4. Test popup shows URLs with `template_id`
5. Disable debug mode and test actual delivery

---

**After following these steps, your messages will DELIVER, not just queue!** 🎉

**For support:** Check server logs, browser console, and use verification scripts.

