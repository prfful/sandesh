# Fix BHASHSMS Template Issue - Complete Guide

## Problem Summary
The unwanted text "hi%20%0Aplz%20find%20uploaded%20file.%20&" (URL-encoded: "hi \nplz find uploaded file. ") was appearing in WhatsApp API URLs instead of using the BHASHSMS template name "dharfc_one".

## Root Cause
The system was incorrectly **replacing** the `text` parameter in the BHASHSMS URL with message content from the database, instead of preserving the BHASHSMS template name.

## What Was Fixed (Code Changes - Already Done ✅)

### 1. Server.js Backend
**Removed:**
- Letter template fetching logic
- Code that replaced the `text` parameter with message content
- All `text=` parameter overrides

**Result:** The `text=dharfc_one` parameter in your BHASHSMS URL is now preserved as-is.

### 2. LetterGenerator.jsx Frontend  
**Removed:**
- Passing `message` parameter to backend API
- `defaultMessage` variable usage

**Result:** Frontend no longer sends any message text that could override the BHASHSMS template.

### 3. WhatsAppSettings.jsx
**Removed:**
- Letter template selector dropdown
- Template imports and queries
- `whatsapp_template_name` state management

**Result:** Cleaner UI without confusing template options.

---

## Database Fix Required (Action Needed ⚠️)

The unwanted text "hi plz find uploaded file" is stored in your database. You need to fix this:

### Step 1: Check Current Value
Open **Hostinger phpMyAdmin** and run:
```sql
SELECT whatsapp_api_url, whatsapp_direct_message FROM appsettings LIMIT 1;
```

### Step 2: Identify the Source
You'll see one of these scenarios:

#### Scenario A: Text is in whatsapp_api_url
If your URL looks like:
```
...&text=hi%20plz%20find%20uploaded%20file&...
```

**Fix:** Update the URL to use BHASHSMS template name:
```sql
UPDATE appsettings 
SET whatsapp_api_url = 'https://bhashsms.com/api/sendmsgutil.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone=9926311439&text=dharfc_one&priority=wa&stype=normal&htype=document&fname=PDF%20File&url=http://144.76.182.197/pushsms/iframe/files/Letter%203031.pdf'
WHERE id = 1;
```

#### Scenario B: Text is in whatsapp_direct_message
If `whatsapp_direct_message` contains "hi plz find uploaded file":

**Fix:** Clear it or set to Hindi default:
```sql
UPDATE appsettings 
SET whatsapp_direct_message = 'नमस्कार,\nकृपया संलग्न पत्र देखें:'
WHERE id = 1;
```

---

## Your Correct BHASHSMS URL Format

```
https://bhashsms.com/api/sendmsgutil.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone={{Mob}}&text=dharfc_one&priority=wa&stype=normal&htype=document&fname=PDF%20File&url={{PdfUrl}}
```

### Key Parameters:
- `phone={{Mob}}` - Will be replaced with actual mobile number
- `text=dharfc_one` - Your BHASHSMS template name (will NOT be changed)
- `url={{PdfUrl}}` - Will be replaced with PDF file URL
- All other parameters remain as-is

---

## How to Update in WhatsApp Settings Page

1. **Go to:** WhatsApp सेटिंग्स page
2. **Select Mode:** बल्क WhatsApp API (BHASHSMS)
3. **Enable API:** Check "कस्टम WhatsApp API सक्षम करें"
4. **Paste URL:** Use the correct BHASHSMS URL format above
5. **Enable Debug:** Check "WhatsApp API डिबग पॉपअप सक्षम करें" (for testing)
6. **Save:** Click "सहेजें"

---

## Testing Steps

### 1. Test with Debug Mode (Recommended First)
1. Enable debug popup in WhatsApp Settings
2. Generate a letter and click WhatsApp button
3. Debug popup will show the actual URL being used
4. **Check:** Does it show `text=dharfc_one`?
5. **Check:** No unwanted text like "hi plz find uploaded file"?

### 2. Copy & Inspect URL
From debug popup:
1. Click "URL कॉपी करें"
2. Paste in notepad
3. Look for: `&text=dharfc_one&`
4. Should NOT see: `&text=hi%20plz%20find%20uploaded%20file&`

### 3. Test Actual Send (After Confirming URL is Correct)
1. Disable debug mode
2. Generate letter and send
3. Check if WhatsApp message is received
4. Verify BHASHSMS template content is used

---

## Expected Behavior After Fix

### ✅ Correct URL:
```
https://bhashsms.com/api/sendmsgutil.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone=9926311439&text=dharfc_one&priority=wa&stype=normal&htype=document&fname=PDF%20File&url=http://144.76.182.197/pushsms/iframe/files/Letter%203031.pdf
```

### ❌ Incorrect URL (Old Problem):
```
https://bhashsms.com/api/sendmsgutil.php?...&text=hi%20%0Aplz%20find%20uploaded%20file.%20&...
```

---

## What the Code Does Now

### Backend (server.js):
1. Reads `whatsapp_api_url` from database
2. Replaces **only** these placeholders:
   - `{{Mob}}` → Actual phone number
   - `{{PdfUrl}}` → PDF file URL
   - `{{SenderName}}` → Sender name (if used)
3. **Preserves** the `text` parameter value (dharfc_one)
4. Does NOT modify or replace `text` parameter

### Frontend (LetterGenerator.jsx):
1. Uploads PDF file
2. Calls backend API with:
   - `pdfUrl` - Uploaded PDF URL
   - `phone` - Clean 10-digit mobile number
   - `recipientName` - Sender name
   - **NO** `message` parameter (removed)
3. Shows debug popup if enabled

---

## Troubleshooting

### Issue: Still seeing unwanted text
**Solution:** 
1. Clear browser cache
2. Check database values again
3. Verify WhatsApp Settings page shows correct URL
4. Enable debug mode and inspect actual URL

### Issue: BHASHSMS says "template not found"
**Solution:**
1. Verify "dharfc_one" template exists in BHASHSMS dashboard
2. Check template name spelling (case-sensitive?)
3. Confirm BHASHSMS API credentials are correct

### Issue: PDF not attaching
**Solution:**
1. Check `url={{PdfUrl}}` placeholder in URL
2. Verify PDF URL is absolute (starts with http://)
3. Confirm BHASHSMS can access the PDF URL (not blocked by firewall)

---

## Summary of Changes

**Files Modified:**
- ✅ `server.js` - Removed text parameter override logic
- ✅ `fronthend/src/pages/LetterGenerator.jsx` - Removed message parameter
- ✅ `fronthend/src/pages/WhatsAppSettings.jsx` - Removed template selector

**Git Commit:** 1441c3f - "Fix BHASHSMS template issue - preserve text=dharfc_one parameter"

**Database Action Required:**
- ⚠️ Update `whatsapp_api_url` if it contains unwanted text
- ⚠️ Clear/update `whatsapp_direct_message` if needed

---

## Next Steps

1. ✅ Code changes are done and deployed
2. ⏳ **YOU:** Fix database values via phpMyAdmin
3. ⏳ **YOU:** Update WhatsApp Settings page with correct URL
4. ⏳ **YOU:** Test with debug mode
5. ⏳ **YOU:** Test actual WhatsApp sending

---

**Last Updated:** February 5, 2026
**Commit:** 1441c3f
