import { emailQueue } from './utils/_queue.js';
import emailProcessor from './utils/_emailProcessor.js';
import dotenv from "dotenv";

emailQueue.process(emailProcessor);

console.log('Email worker is running and processing jobs...');
