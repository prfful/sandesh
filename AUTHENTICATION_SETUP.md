# प्रमाणीकरण प्रणाली सेटअप गाइड
# Authentication System Setup Guide

## स्थापना चरण / Setup Steps

### 1. डेटाबेस अपडेट / Update Database
```bash
# पेज अनुमतियाँ कॉलम जोड़ें / Add page permissions column
node add-page-permissions.js
```

### 2. प्रारंभिक एडमिन बनाएं / Create Initial Admin
```bash
# यदि कोई एडमिन नहीं है तो एक बनाएं / Create admin if none exists
node create-admin-user.js
```

### 3. सर्वर शुरू करें / Start Server
```bash
# बैकएंड API (Terminal 1)
npm run api

# फ्रंटएंड (Terminal 2)
npm run frontend:dev
```

### 4. लॉगिन करें / Login
1. ब्राउज़र में खोलें / Open in browser: http://localhost:5173
2. लॉगिन पेज पर स्वचालित रीडायरेक्ट होगा / Auto-redirect to login page
3. एडमिन क्रेडेंशियल्स डालें / Enter admin credentials:
   - Email: admin@test.com (या जो भी मौजूद है)
   - Password: (आपका पासवर्ड)

## मुख्य विशेषताएं / Key Features

### ✅ लॉगिन सिस्टम / Login System
- यूज़रनेम और पासवर्ड से लॉगिन / Login with username & password
- पहली बार वेबसाइट पर जाने पर लॉगिन की आवश्यकता / Login required on first visit
- सफल लॉगिन के बाद ही वेबसाइट एक्सेस / Website access only after successful login

### ✅ भूमिका-आधारित एक्सेस / Role-Based Access
- **Admin**: सभी पेज देख सकता है / Can see all pages including settings
- **Operator**: केवल अनुमत पेज देख सकता है / Can see only permitted pages

### ✅ पेज अनुमतियाँ प्रबंधन / Page Permissions Management
- यूजर मैनेजमेंट में **"अनुमतियाँ सेट करें"** सेक्शन / "अनुमतियाँ सेट करें" section in User Management
- हर यूजर के लिए पेज एक्सेस सेट करें / Set page access for each user
- Admin सभी पेज देखता है / Admin sees all pages automatically
- Operator केवल assigned पेज देखता है / Operator sees only assigned pages

## यूजर प्रबंधन / User Management

### नया यूजर बनाना / Creating New User
1. यूजर मैनेजमेंट पेज पर जाएं / Go to User Management page
2. "नया यूजर" बटन क्लिक करें / Click "नया यूजर" button
3. विवरण भरें / Fill details:
   - नाम / Name
   - ईमेल / Email
   - पासवर्ड / Password
   - भूमिका / Role (Admin या Operator)
   - अनुमतियाँ / Permissions (checkboxes)
4. "यूजर बनाएं" क्लिक करें / Click "यूजर बनाएं"

### पेज अनुमतियाँ सेट करना / Setting Page Permissions
1. यूजर लिस्ट से यूजर चुनें / Select user from list
2. दाईं ओर **"अनुमतियाँ सेट करें"** सेक्शन दिखेगा / "अनुमतियाँ सेट करें" section appears on right
3. **"पेज एक्सेस अनुमतियाँ"** में चेकबॉक्स देखें / See "पेज एक्सेस अनुमतियाँ" checkboxes
4. जो पेज दिखाने हैं उन्हें चेक करें / Check pages to allow access
5. बदलाव स्वचालित सेव होते हैं / Changes save automatically

### उपलब्ध पेज / Available Pages
- ✅ डैशबोर्ड / Dashboard
- ✅ नया / संपादित निमंत्रण / DataEntry
- ✅ रिमाइंडर सूची / ReminderList
- ✅ बल्क ऑपरेशन्स / BulkOperations
- ✅ पत्र जनरेटर / LetterGenerator
- ✅ पत्र टेम्पलेट्स / LetterTemplates
- ✅ पत्र सेटिंग्स / LetterSettings
- ✅ कार्यक्रम प्रकार मास्टर / ProgramTypeMaster
- ✅ WhatsApp सेटिंग्स / WhatsAppSettings
- ✅ Database Viewer
- ✅ यूजर मैनेजमेंट / UserManagement
- ✅ ऑपरेटर प्रबंधन / OperatorManagement

## Operator के लिए उदाहरण / Example for Operator

### परिदृश्य / Scenario:
एक Operator को केवल निमंत्रण जोड़ने और रिमाइंडर देखने की अनुमति देनी है।
Want to give an operator access to only add invitations and view reminders.

### कदम / Steps:
1. Admin लॉगिन करें / Login as Admin
2. यूजर मैनेजमेंट पर जाएं / Go to User Management
3. Operator यूजर बनाएं / Create Operator user
4. **पेज एक्सेस अनुमतियाँ** में चेक करें:
   - ☑ डैशबोर्ड
   - ☑ नया / संपादित निमंत्रण
   - ☑ रिमाइंडर सूची
5. Operator लॉगिन करेगा तो केवल ये 3 पेज दिखेंगे / Operator will only see these 3 pages

## लॉगआउट / Logout
- ऊपर दाएं कोने में "लॉगआउट" बटन / "लॉगआउट" button in top right corner
- क्लिक करने पर लॉगिन पेज पर जाएगा / Clicking redirects to login page

## सुरक्षा नोट / Security Notes

⚠️ **महत्वपूर्ण / Important:**
- डिफ़ॉल्ट एडमिन पासवर्ड बदलें / Change default admin password
- प्रोडक्शन में मजबूत पासवर्ड इस्तेमाल करें / Use strong passwords in production
- नियमित रूप से पासवर्ड अपडेट करें / Update passwords regularly

## समस्या समाधान / Troubleshooting

### लॉगिन पेज पर बार-बार जा रहा है / Keeps redirecting to login
```bash
# Browser Console में:
localStorage.clear()
# फिर पेज रीफ्रेश करें और लॉगिन करें
```

### Operator को पेज नहीं दिख रहे / Operator not seeing pages
1. यूजर मैनेजमेंट में check करें कि पेज अनुमतियाँ सेट हैं
2. Operator लॉगआउट करके दोबारा लॉगिन करें
3. Browser cache clear करें

### पासवर्ड भूल गए / Forgot Password
```bash
# एडमिन की मदद से UserManagement में पासवर्ड बदलें
# या डेटाबेस से सीधे अपडेट करें
```

## विस्तृत दस्तावेज़ / Detailed Documentation
अधिक जानकारी के लिए देखें / See for more details:
- `AUTHENTICATION_GUIDE.md` - Complete technical documentation

## सहायता / Support
किसी भी समस्या के लिए डेवलपर से संपर्क करें।
For any issues, contact the developer.
