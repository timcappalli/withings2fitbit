import PushOver from 'pushover-notifications';

const DEBUG = process.env.DEBUG === 'true';
const PUSHOVER_USER = process.env.PUSHOVER_USER || null;
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN || null;


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

export function sendPushoverMessage(message, title = 'Withings2Fitbit') {
    if (!PUSHOVER_USER || !PUSHOVER_TOKEN) return;
    const pusher = new PushOver({ user: PUSHOVER_USER, token: PUSHOVER_TOKEN });
    pusher.send({ message, title }, (err) => {
        if (err) console.error('[sendPushoverMessage] Error:', err);
    });
}