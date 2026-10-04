# WhatsApp Text Message API गाइड
## पार्टी कार्यकर्ता प्रबंधन के लिए

### Overview
यह API BHASHSMS के माध्यम से बिना PDF attachment के सीधे text messages भेजने के लिए है। यह निमंत्रण पत्र (invitation) API से अलग है।

---

## Backend API Endpoint

### POST `/api/functions/sendWhatsAppMessage`

**उद्देश्य:** पार्टी कार्यकर्ताओं को bulk text messages भेजना (बिना PDF के)

**Request Body:**
```json
{
  "phone": "9876543210",
  "recipientName": "राम कुमार",
  "message": "आपको जन्मदिन की हार्दिक शुभकामनाएं!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "statusCode": 200,
  "statusMessage": "संदेश सफलतापूर्वक भेजा गया!",
  "data": { /* BHASHSMS response */ },
  "bhashResponse": "...",
  "timestamp": "2026-01-26T10:30:00.000Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "statusCode": 401,
  "statusMessage": "अमान्य API कुंजी या प्रमाणीकरण विफल",
  "error": "...",
  "timestamp": "2026-01-26T10:30:00.000Z"
}
```

---

## BHASHSMS API URL Structure

### निमंत्रण पत्र (PDF के साथ):
```
https://api.bhashsms.com/api/sendmsg.php?user=...&pass=...&sender=...&phone=9876543210&text=dharfc_one&priority=wa&stype=normal&htype=document&fname=Letter6001.pdf&url=http://example.com/uploads/letter.pdf
```

### टेक्स्ट मैसेज (बिना PDF के):
```
https://api.bhashsms.com/api/sendmsg.php?user=...&pass=...&sender=...&phone=9876543210&text=आपको%20जन्मदिन%20की%20शुभकामनाएं&priority=wa&stype=normal
```

**मुख्य अंतर:**
- ❌ `htype=document` - हटा दिया
- ❌ `fname=...` - हटा दिया  
- ❌ `url=...` - हटा दिया
- ✅ केवल base parameters रखे गए

---

## Backend Implementation Details

### Phone Number Cleaning
```javascript
// Remove non-digits
let cleanPhone = phone.replace(/\D/g, '');

// Remove country code if 12 digits starting with 91
if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
  cleanPhone = cleanPhone.substring(2);
}
```

### PDF Parameters Removal
```javascript
// Remove PDF-related params from template URL
apiUrl = apiUrl.replace(/[?&]url=[^&]*/gi, '');
apiUrl = apiUrl.replace(/[?&]fname=[^&]*/gi, '');
apiUrl = apiUrl.replace(/[?&]htype=document/gi, '');

// Clean up double && or ?&
apiUrl = apiUrl.replace(/&&+/g, '&');
apiUrl = apiUrl.replace(/\?&/g, '?');
apiUrl = apiUrl.replace(/&$/g, '');
```

### Text Encoding
```javascript
// Use %20 for spaces, not '+' (BHASHSMS requirement)
const encodedMsg = encodeURIComponent(message);

// Manual text parameter override (avoid URLSearchParams)
if (/([?&])text=/.test(apiUrl)) {
  apiUrl = apiUrl.replace(/text=[^&]*/i, `text=${encodedMsg}`);
} else {
  apiUrl += (apiUrl.includes('?') ? '&' : '?') + `text=${encodedMsg}`;
}
```

---

## Frontend Usage

### Method 1: Direct API Call
```javascript
import restClient from '@/api/restClient';

const response = await restClient.invokeFunction('sendWhatsAppMessage', {
  phone: person.Mobile,
  recipientName: person.Name,
  message: "आपको जन्मदिन की हार्दिक शुभकामनाएं!"
});

if (response.success) {
  toast.success('संदेश भेजा गया!');
} else {
  toast.error(response.statusMessage);
}
```

### Method 2: Using Helper Function
```javascript
import { sendWhatsAppMessage } from '@/api/functions';

const response = await sendWhatsAppMessage({
  phone: '9876543210',
  recipientName: 'राम कुमार',
  message: 'शुभकामनाएं!'
});
```

### Method 3: Bulk Sending (Existing WhatsAppBulk.jsx)
```javascript
// fronthend/src/pages/WhatsAppBulk.jsx में पहले से implemented है

for (const person of filtered) {
  const finalMsg = replaceVars(message, person, desigText, mandalName);
  
  try {
    const resp = await sendWhatsAppMessage({ 
      phone: person.Mobile, 
      recipientName: person.Name, 
      message: finalMsg 
    });
    
    if (resp?.success) successCount++;
    
    // Log to database
    await logWhatsAppSend({ 
      person_id: person.id, 
      type: 'bulk', 
      message: finalMsg, 
      status: resp?.success ? 'success' : 'failed',
      response: JSON.stringify(resp || {}) 
    });
  } catch (e) {
    console.error('Error:', e);
  }
}
```

---

## Message Placeholder Variables

**WhatsAppBulk.jsx में available variables:**
- `{{Name}}` - कार्यकर्ता का नाम
- `{{Designation}}` - पद (PoliticianType से)
- `{{Village_City}}` - गाँव/शहर
- `{{Mandal}}` - मण्डल का नाम

**Example Message:**
```
नमस्कार {{Name}} जी,

आप {{Designation}} के पद पर {{Mandal}} मण्डल में कार्यरत हैं। 
आपको आगामी बैठक के लिए आमंत्रित किया जाता है।

धन्यवाद।
```

---

## Error Handling

### Status Code Mapping
```javascript
401 → "अमान्य API कुंजी या प्रमाणीकरण विफल"
400 → "अमान्य अनुरोध प्रारूप या गुम पैरामीटर"
403 → "फोन नंबर WhatsApp API के लिए अनुमोदित नहीं"
422 → "अमान्य पेलोड या प्रारूप त्रुटि"
429 → "दर सीमा पार। बाद में पुन: प्रयास करें।"
500+ → "WhatsApp API सर्वर त्रुटि। बाद में पुन: प्रयास करें।"
```

### Frontend Error Display
```javascript
try {
  const resp = await sendWhatsAppMessage({ phone, recipientName, message });
  
  if (resp.success) {
    toast.success(resp.statusMessage);
  } else {
    toast.error(resp.statusMessage || 'भेजने में विफल');
  }
} catch (error) {
  toast.error('नेटवर्क त्रुटि: ' + error.message);
}
```

---

## Database Logging

### whatsapp_log Table Schema
```sql
CREATE TABLE whatsapp_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  person_id INT,
  type VARCHAR(50), -- 'bulk', 'birthday', 'anniversary'
  message TEXT,
  status VARCHAR(20), -- 'success', 'failed'
  response TEXT, -- JSON response from API
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Log Function
```javascript
import { logWhatsAppSend } from '@/api/functions';

await logWhatsAppSend({ 
  person_id: person.id, 
  type: 'bulk', 
  message: finalMsg, 
  status: 'success',
  response: JSON.stringify(response) 
});
```

---

## Testing

### 1. Test Backend Endpoint Directly
```bash
curl -X POST http://localhost:5000/api/functions/sendWhatsAppMessage \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","recipientName":"Test User","message":"Test Message"}'
```

### 2. Test via Frontend
1. Navigate to "व्हाट्सएप संदेश भेजें" page
2. Select मण्डल and पद
3. Enter message: `नमस्कार {{Name}} जी, {{Designation}}`
4. Click "📤 Send Message"
5. Check console logs for API URL and response

### 3. Verify URL Format
**Backend logs will show:**
```
Final Text Message API URL: https://api.bhashsms.com/api/sendmsg.php?user=...&pass=...&sender=...&phone=9876543210&text=Test%20Message&priority=wa&stype=normal
```

**Verify:**
- ✅ No `url=` parameter
- ✅ No `fname=` parameter
- ✅ No `htype=document` parameter
- ✅ Text has `%20` for spaces (not `+`)
- ✅ Phone is 10 digits (no country code)

---

## Comparison: PDF vs Text API

| Feature | sendWhatsAppPDF | sendWhatsAppMessage |
|---------|----------------|-------------------|
| **Purpose** | Invitation letters | Party worker messages |
| **PDF Attachment** | ✅ Yes | ❌ No |
| **Parameters** | url, fname, htype=document | Only text, phone |
| **Message Content** | Fixed: "dharfc_one" | Dynamic: User input |
| **URL Encoding** | encodeURI for url | encodeURIComponent for text |
| **Phone Cleaning** | ✅ Yes | ✅ Yes |
| **Status Update** | Updates `pragram.sended` | Logs to `whatsapp_log` |
| **Frontend Page** | LetterGenerator.jsx | WhatsAppBulk.jsx |

---

## Configuration

### AppSettings Table
```sql
SELECT * FROM appsettings;
```

**Required Fields:**
- `whatsapp_api_enabled` = `1` (TRUE)
- `whatsapp_api_url` = Base template URL with placeholders
- `whatsapp_mode` = `'api'` (not 'direct')

**Template Example:**
```
https://api.bhashsms.com/api/sendmsg.php?user=YOUR_USER&pass=YOUR_PASS&sender=YOUR_SENDER&phone={{Mob}}&text={{Message}}&priority=wa&stype=normal&htype=document&fname={{Sn}}.pdf&url={{PdfUrl}}
```

**Note:** PDF parameters (`htype`, `fname`, `url`) will be automatically removed for text messages.

---

## Troubleshooting

### Issue: URL still has `htype=document`
**Solution:** Backend removes it automatically. Check console logs for "Final Text Message API URL".

### Issue: Spaces encoded as `+` instead of `%20`
**Solution:** Backend uses `encodeURIComponent` and manual parameter override (not URLSearchParams).

### Issue: Phone validation fails
**Solution:** Backend cleans phone automatically (removes non-digits, strips country code if 12 digits).

### Issue: API returns 401 Unauthorized
**Solution:** Check `appsettings.whatsapp_api_url` has correct credentials (user, pass, sender).

### Issue: Message not received on WhatsApp
**Solution:** 
1. Verify phone number is WhatsApp-enabled
2. Check BHASHSMS account has credits
3. Verify phone is approved in BHASHSMS panel

---

## Files Modified

### Backend
- `server.js` - Updated `/api/functions/sendWhatsAppMessage` endpoint (lines 896-1024)

### Frontend (No changes needed)
- `fronthend/src/api/restClient.js` - Already has `invokeFunction()`
- `fronthend/src/api/functions.js` - Already exports `sendWhatsAppMessage`
- `fronthend/src/pages/WhatsAppBulk.jsx` - Already uses `sendWhatsAppMessage()`

---

## Next Steps

1. ✅ **Backend endpoint updated** - `sendWhatsAppMessage` now removes PDF parameters
2. ⏭️ **Test with BHASHSMS** - Use debug prompt to verify URL format
3. ⏭️ **Database logging** - Verify `whatsapp_log` table captures all sends
4. ⏭️ **Bulk testing** - Send test message to 2-3 workers first
5. ⏭️ **Production rollout** - Enable for full mण्डल after testing

---

## Support
For issues:
1. Check backend console logs for "Final Text Message API URL"
2. Verify `appsettings` table configuration
3. Test with BHASHSMS sandbox/test numbers first
4. Contact BHASHSMS support for API-specific issues
