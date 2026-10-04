#!/usr/bin/env node

// Test the WhatsApp URL building logic locally

const CURRENT_API_URL = 'https://bhashsms.com/api/sendmsg.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone={{Mob}}&text={{Message}}&priority=wa&stype=normal';

const testCases = [
  {
    name: 'Test 1: Simple name and message',
    recipientName: 'prafull',
    message: 'नमस्‍कार prafull जी bharat mata ki jay',
    phone: '9425307072'
  },
  {
    name: 'Test 2: Hindi text with spaces',
    recipientName: 'राज कुमार',
    message: 'नमस्कार राज जी, आपका स्वागत है',
    phone: '9876543210'
  },
  {
    name: 'Test 3: Mixed content',
    recipientName: 'Priya',
    message: 'Hello प्रिया, welcome aboard',
    phone: '9123456789'
  }
];

function buildUrl_OLD(apiUrl, phone, recipientName, message) {
  let url = apiUrl;
  
  // OLD WAY (WRONG) - uses searchParams which converts spaces to +
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('phone', phone);
    urlObj.searchParams.set('text', message); // WRONG: sending full message
    urlObj.searchParams.set('params', `${recipientName},${message}`);
    return urlObj.toString();
  } catch (e) {
    return 'ERROR: ' + e.message;
  }
}

function buildUrl_NEW(apiUrl, phone, recipientName, message) {
  let url = apiUrl;
  
  // NEW WAY (CORRECT) - uses %20 for spaces, sends template name in text param
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('phone', phone);
    urlObj.searchParams.set('text', 'team_neena_verma9'); // Template name
    
    // Manually build params to avoid + symbols for spaces
    const paramsNameEncoded = recipientName.replace(/ /g, '%20');
    const paramsMessageEncoded = message.replace(/ /g, '%20');
    const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
    
    const urlString = urlObj.toString();
    url = urlString.includes('?') 
      ? `${urlString}&params=${paramsValue}`
      : `${urlString}?params=${paramsValue}`;
      
    return url;
  } catch (e) {
    return 'ERROR: ' + e.message;
  }
}

// Run tests
console.log('\n' + '═'.repeat(120));
console.log('WHATSAPP MESSAGE URL BUILDER TEST');
console.log('═'.repeat(120) + '\n');

testCases.forEach((testCase, idx) => {
  console.log(`\n${'─'.repeat(120)}`);
  console.log(`${testCase.name}`);
  console.log(`${'─'.repeat(120)}`);
  console.log(`📱 Phone: ${testCase.phone}`);
  console.log(`👤 Name: ${testCase.recipientName}`);
  console.log(`💬 Message: ${testCase.message}`);
  console.log();

  const oldUrl = buildUrl_OLD(CURRENT_API_URL, testCase.phone, testCase.recipientName, testCase.message);
  const newUrl = buildUrl_NEW(CURRENT_API_URL, testCase.phone, testCase.recipientName, testCase.message);

  console.log('🔴 OLD (WRONG - spaces as +):');
  console.log(oldUrl);
  console.log();

  console.log('🟢 NEW (CORRECT - spaces as %20 + template name):');
  console.log(newUrl);
  console.log();

  // Check for issues
  const issues = [];
  if (oldUrl.includes('+')) issues.push('❌ Contains + symbols for spaces');
  if (oldUrl.includes('%E0%A4')) issues.push('❌ Contains URL-encoded Unicode');
  if (newUrl.includes('+')) issues.push('❌ NEW also has + symbols!');
  if (!newUrl.includes('text=team_neena_verma9')) issues.push('❌ NEW missing template name');
  
  if (issues.length > 0) {
    console.log('⚠️  Issues detected:');
    issues.forEach(issue => console.log('   ' + issue));
  } else {
    console.log('✅ NEW URL is correct!');
  }
});

console.log('\n' + '═'.repeat(120));
console.log('SUMMARY');
console.log('═'.repeat(120));
console.log(`
OLD URL Problems:
  ❌ Spaces encoded as + (should be %20)
  ❌ Full message in URL (should be template name)
  ❌ Hindi text URL-encoded (should be plain UTF-8)

NEW URL Fixes:
  ✅ Spaces encoded as %20
  ✅ Template name in 'text' parameter (team_neena_verma9)
  ✅ Hindi text stays readable
  ✅ Name and message in 'params' parameter
`);
