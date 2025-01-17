import 'dotenv/config';
const DEBUG = process.env.DEBUG || false;


export function debugLog(message) {
    if (DEBUG) {
      console.log(message);
    }
  }
  
  export function debugError(message) {
    if (DEBUG) {
      console.error(message);
    }
  }