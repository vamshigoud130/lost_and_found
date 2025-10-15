#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Lost & Found Email Setup');
console.log('==========================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Email Configuration
# For development, you can use Gmail with app passwords
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Lost & Found <noreply@lostandfound.com>
FRONTEND_URL=http://localhost:5173

# Database
MONGO_URI=mongodb://127.0.0.1:27017/lost_and_found

# Server
PORT=4000

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
} else {
  console.log('✅ .env file already exists');
}

console.log('\n📧 Email Configuration Instructions:');
console.log('=====================================');
console.log('1. Open the .env file in your editor');
console.log('2. Replace "your-email@gmail.com" with your Gmail address');
console.log('3. Replace "your-app-password" with your Gmail app password');
console.log('4. For Gmail app password:');
console.log('   - Enable 2-factor authentication on your Google account');
console.log('   - Go to Google Account settings > Security > App passwords');
console.log('   - Generate a new app password for "Mail"');
console.log('   - Use that password (not your regular password)');
console.log('\n5. Save the .env file and restart your server');
console.log('\n💡 Alternative: You can use other email services like SendGrid, AWS SES, etc.');
console.log('   Just modify the emailService.js file accordingly.\n');

console.log('🚀 Next steps:');
console.log('1. Configure your email settings in .env');
console.log('2. Run: npm run dev');
console.log('3. Test email functionality in the admin dashboard\n');

console.log('📱 Note: Even without email configuration, the system will create');
console.log('   in-app notifications as a fallback when email fails.');
