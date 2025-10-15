# Email Setup Instructions

## Configuration

To enable email functionality, you need to set up the following environment variables:

### For Gmail (Recommended for development):

1. Create a `.env` file in the backend directory with:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Lost & Found <noreply@lostandfound.com>
FRONTEND_URL=http://localhost:5173
```

2. For Gmail, you need to:
   - Enable 2-factor authentication on your Google account
   - Generate an "App Password" for this application
   - Use the app password (not your regular password) in EMAIL_PASS

### For other SMTP providers:

You can modify the `createTransporter()` function in `backend/services/emailService.js` to use other providers like:
- SendGrid
- AWS SES
- Mailgun
- Custom SMTP server

## Testing

1. Start the backend server: `npm run dev`
2. Go to the admin dashboard
3. Create or find a match
4. Click "📧 Send Email" button
5. Enter a custom message and send

## Features

- ✅ Sends HTML emails with match details
- ✅ Includes custom admin messages
- ✅ Creates in-app notifications as backup
- ✅ Shows success/failure status
- ✅ Professional email template
- ✅ Responsive design

## Troubleshooting

- Make sure your email credentials are correct
- Check that 2FA is enabled for Gmail
- Verify the app password is generated correctly
- Check server logs for detailed error messages
