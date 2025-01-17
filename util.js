import 'dotenv/config';
import PushOver from 'pushover-notifications';

const DEBUG = process.env.DEBUG || false;
const PUSHOVER_USER = process.env.PUSHOVER_USER || null;
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN || null;


export function debugLog(message) {
  if (DEBUG) {
    console.log(message);
  }
};

export function debugError(message) {
  if (DEBUG) {
    console.error(message);
  }
};

var pusher = new PushOver({
    user: PUSHOVER_USER,
    token: PUSHOVER_TOKEN,
});

export function sendPushoverMessage(title = 'Withings2Fitbit', message ) {
  pusher.send({message, title}, function (err, result) {
      if (err) {
          throw err
      }
  });
};