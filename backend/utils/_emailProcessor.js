import sendMail from "./_sendMail.js";

export default async function (job) {
    try {
        const emailData = job.data;
        await sendMail({
            email: emailData.to,
            subject: emailData.subject,
            message: emailData.text,
        });
        return { success: true };
    } catch (error) {
        throw new Error(error.message);
    }
}
