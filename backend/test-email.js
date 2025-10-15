require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
  console.log('🧪 Testing Email Configuration...');
  console.log('===================================\n');

  const testEmail = process.argv[2] || 'test@example.com';
  
  try {
    const result = await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email from Lost & Found System',
      html: `
        <h2>🎉 Email Test Successful!</h2>
        <p>This is a test email from your Lost & Found system.</p>
        <p>If you received this email, your email configuration is working correctly!</p>
        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
      `,
      text: `
        Email Test Successful!
        
        This is a test email from your Lost & Found system.
        If you received this email, your email configuration is working correctly!
        
        Sent at: ${new Date().toLocaleString()}
      `
    });

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log(`📧 Check ${testEmail} for the test email.`);
    } else {
      console.log('❌ Email failed to send:');
      console.log('Error:', result.error);
      console.log('\n🔧 To fix this:');
      console.log('1. Make sure EMAIL_USER and EMAIL_PASS are set in .env');
      console.log('2. For Gmail, use an app password (not your regular password)');
      console.log('3. Enable 2-factor authentication on your Google account');
    }
  } catch (error) {
    console.log('❌ Email test failed:');
    console.log('Error:', error.message);
    console.log('\n🔧 To fix this:');
    console.log('1. Run: node configure-email.js');
    console.log('2. Or manually edit the .env file with your email credentials');
  }
}

testEmail();
