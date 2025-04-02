/**
 * Generates an email object for password reset requests.
 * @param {string} host - The host domain for the reset link (e.g., 'example.com')
 * @param {string} token - The unique reset token for the user
 * @returns {Object} Email object with subject and message properties
 */
const generatePasswordResetEmail = (host, token) => {
    return {
        subject: 'Password Reset',                    // Email subject line
        message: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        http://${host}/reset/${token}\n\n          // Reset link with host and token
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };
};

export default generatePasswordResetEmail;
