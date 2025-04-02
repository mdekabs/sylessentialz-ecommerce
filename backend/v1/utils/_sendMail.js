import nodemailer from "nodemailer";

/**
 * Sends an email using Nodemailer with SMTP configuration from environment variables.
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient's email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Email body text
 * @returns {Promise<void>} Resolves when email is sent
 * @throws {Error} If email sending fails
 */
const sendMail = async (options) => {
  // Create SMTP transporter with environment-based config
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,      // SMTP server hostname
    port: process.env.SMTP_PORT,      // SMTP server port
    secure: false,                    // Use TLS (false for non-SSL)
    service: process.env.SMTP_SERVICE,// SMTP service 
    auth: {
      user: process.env.SMTP_MAIL,    // Sender email address
      pass: process.env.SMTP_PASSWORD // Sender email password
    },
  });

  // Define email options
  const mailOptions = {
    from: process.env.SMTP_MAIL,      // Sender address
    to: options.email,                // Recipient address
    subject: options.subject,         // Subject line
    text: options.message,            // Plain text body
  };

  // Send the email
  await transporter.sendMail(mailOptions); // Executes email delivery
};

export default sendMail;
