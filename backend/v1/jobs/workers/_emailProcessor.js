import { logger } from "../../config/logger.js";
import sendMail from "../../utils/sendMail.js";

/**
 * Processes an email job and sends it using the sendMail utility.
 * Designed for use with a job queue (e.g., Bull).
 * @param {Object} job - The job object containing email data
 * @param {Object} job.data - Email details (to, subject, text)
 * @param {Function} done - Callback to signal job completion or failure
 * @returns {Promise<Object>} Success object if email is sent
 * @throws {Error} If email sending fails
 */
export default async function (job, done) {
  try {
    const emailData = job.data; // Extract email data from job
    await sendMail({
      email: emailData.to, // Recipient email address
      subject: emailData.subject, // Email subject line
      message: emailData.text, // Email body content
    });
    logger.info(`Email sent successfully to ${emailData.to}`);
    done(); // Signal successful completion
    return { success: true }; // Return success indicator
  } catch (error) {
    logger.error(`Failed to send email to ${job.data.to}: ${error.message}`);
    done(error); // Signal failure with error
    throw new Error(error.message); // Re-throw for upstream handling
  }
}