# Email Service Alternatives

## Option 1: Gmail (Current)
- Make sure 2FA is enabled
- Generate a new app password
- Update EMAIL_PASS in .env

## Option 2: Outlook/Hotmail
Update your .env file:
```
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

And update emailService.js to use:
```javascript
return nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## Option 3: Custom SMTP
For any other email provider:
```javascript
return nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## Option 4: SendGrid (Recommended for Production)
1. Sign up at sendgrid.com
2. Get API key
3. Update emailService.js to use SendGrid

## Current Status
Your email is configured but Gmail authentication is failing.
The system will still work with in-app notifications as fallback.
