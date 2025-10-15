#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📧 Email Configuration Helper');
console.log('==============================\n');

// Get user input for email configuration
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Please provide your email configuration:');
console.log('(Press Enter to skip and use defaults)\n');

rl.question('Gmail Address (e.g., yourname@gmail.com): ', (email) => {
  rl.question('Gmail App Password (16 characters): ', (password) => {
    rl.question('From Name (e.g., Lost & Found): ', (fromName) => {
      rl.question('Frontend URL (e.g., http://localhost:5173): ', (frontendUrl) => {
        
        // Create .env content
        const envContent = `# Email Configuration
EMAIL_USER=${email || 'your-email@gmail.com'}
EMAIL_PASS=${password || 'your-app-password'}
EMAIL_FROM=${fromName || 'Lost & Found'} <noreply@lostandfound.com>
FRONTEND_URL=${frontendUrl || 'http://localhost:5173'}

# Database
MONGO_URI=mongodb://127.0.0.1:27017/lost_and_found

# Server
PORT=4000

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
`;

        // Write .env file
        const envPath = path.join(__dirname, '.env');
        fs.writeFileSync(envPath, envContent);
        
        console.log('\n✅ .env file updated successfully!');
        console.log('\n📧 Email Configuration:');
        console.log('========================');
        console.log('Email User:', email || 'your-email@gmail.com');
        console.log('From Name:', fromName || 'Lost & Found');
        console.log('Frontend URL:', frontendUrl || 'http://localhost:5173');
        
        if (!email || !password) {
          console.log('\n⚠️  IMPORTANT: You need to configure your email settings!');
          console.log('\n🔧 To configure Gmail:');
          console.log('1. Go to your Google Account settings');
          console.log('2. Enable 2-factor authentication');
          console.log('3. Go to Security → App passwords');
          console.log('4. Generate a new app password for "Mail"');
          console.log('5. Edit the .env file with your credentials');
        } else {
          console.log('\n🚀 Email is configured! Restart your server to apply changes.');
          console.log('Run: npm run dev');
        }
        
        console.log('\n📱 Note: Even without email, users will get in-app notifications.');
        
        rl.close();
      });
    });
  });
});
