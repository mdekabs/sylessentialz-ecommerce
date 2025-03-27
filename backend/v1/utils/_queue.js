import "dotenv/config";
import Queue from "bull";

const emailQueue = new Queue("emailQueue", {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

export { emailQueue };
