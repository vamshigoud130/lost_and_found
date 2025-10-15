const nodemailer = require('nodemailer');

// Email service configuration
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, consider using services like SendGrid, AWS SES, etc.
  
  // Gmail configuration (you'll need to set up app passwords)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
  
  // Alternative: SMTP configuration
  // return nodemailer.createTransporter({
  //   host: process.env.SMTP_HOST || 'smtp.gmail.com',
  //   port: process.env.SMTP_PORT || 587,
  //   secure: false,
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASS
  //   }
  // });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.');
      return { 
        success: false, 
        error: 'Email service not configured. Please contact administrator.' 
      };
    }
    
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Lost & Found <noreply@lostandfound.com>',
      to,
      subject,
      html,
      text
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

const sendMatchNotificationEmail = async (userEmail, userName, matchDetails, customMessage) => {
  const subject = `🔍 Potential Match Found - Lost & Found`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Match Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .match-details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .btn { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔍 Lost & Found</h1>
          <h2>Potential Match Found!</h2>
        </div>
        
        <div class="content">
          <p>Hello ${userName},</p>
          
          <p>We have found a potential match for your item in our Lost & Found system.</p>
          
          ${customMessage ? `<div class="match-details">
            <h3>📝 Admin Message:</h3>
            <p><em>"${customMessage}"</em></p>
          </div>` : ''}
          
          <div class="match-details">
            <h3>📋 Match Details:</h3>
            <p><strong>Match Status:</strong> ${matchDetails.status}</p>
            <p><strong>Created:</strong> ${new Date(matchDetails.createdAt).toLocaleDateString()}</p>
            ${matchDetails.notes ? `<p><strong>Notes:</strong> ${matchDetails.notes}</p>` : ''}
          </div>
          
          <p>Please log into your account to review the match and take appropriate action.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/matches" class="btn">
              View Match Details
            </a>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <p>Best regards,<br>
          Lost & Found Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message from the Lost & Found system.</p>
          <p>If you believe this email was sent in error, please ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Hello ${userName},
    
    We have found a potential match for your item in our Lost & Found system.
    
    ${customMessage ? `Admin Message: "${customMessage}"` : ''}
    
    Match Details:
    - Status: ${matchDetails.status}
    - Created: ${new Date(matchDetails.createdAt).toLocaleDateString()}
    ${matchDetails.notes ? `- Notes: ${matchDetails.notes}` : ''}
    
    Please log into your account to review the match: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/matches
    
    Best regards,
    Lost & Found Team
  `;
  
  return await sendEmail({
    to: userEmail,
    subject,
    html,
    text
  });
};

module.exports = {
  sendEmail,
  sendMatchNotificationEmail
};

