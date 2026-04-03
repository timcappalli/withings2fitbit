import 'dotenv/config';
import { DateTime } from 'luxon';
import axios from 'axios';
import { returnFitbitTokens, returnWithingsTokens } from './tokenHandling.js';
import schedule from 'node-schedule';
import * as utils from './util.js';


const TIMEZONE_STRING = process.env.TIMEZONE_STRING || 'America/New_York';
const RUN_HOUR = process.env.RUN_HOUR || 12; // run at noon local time
const APP_MODE = process.env.APP_MODE || 'MANUAL'; // run in manual invocation mode by default
const PUSHOVER = !!(process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN);
const DEBUG = process.env.DEBUG === 'true';


function decodeWithingsValue({ value, unit }) {
    const raw = `${value}`;
    const pos = raw.length - (unit * -1);
    return `${raw.slice(0, pos)}.${raw.slice(pos)}`;
}

function parseWithingsData(data) {
    const measures = data.measuregrps[0].measures;
    const result = {};

    const weightData = measures.find(item => item.type === 1);
    if (weightData) result.weight = decodeWithingsValue(weightData);

    const fatData = measures.find(item => item.type === 6);
    if (fatData) result.fat = decodeWithingsValue(fatData);

    const ts = DateTime.fromSeconds(data.measuregrps[0].date).setZone(TIMEZONE_STRING);
    result.date = ts.toFormat('yyyy-MM-dd');
    result.time = ts.toFormat('HH:mm:ss');

    return result;
}

async function fetchWithingsData(token, dateTime) {
    const withingsPayload = {
        action: 'getmeas',
        meastypes: '1,6',
        category: '1',
        lastupdate: dateTime
    };

    try {
        const response = await axios.post('https://scalews.withings.com/measure', new URLSearchParams(withingsPayload).toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.body;
    } catch (error) {
        utils.debugError('[fetchWithingsData] Error making POST request:', error);
    }
}

async function postFitbitLog(token, endpoint, params) {
    try {
        const response = await axios.post(`https://api.fitbit.com/1/user/-/body/log/${endpoint}.json`, null, {
            params,
            headers: { Authorization: `Bearer ${token}` }
        });
        return { status: response.status, data: response.data };
    } catch (error) {
        utils.debugError(`[postFitbitLog/${endpoint}] Error making POST request:`, error);
    }
}

async function update() {
    try {
        const startDay = DateTime.now().setZone(TIMEZONE_STRING).startOf('day').toUnixInteger();

        const withingsTokens = await returnWithingsTokens();
        utils.debugLog(`withingsTokens: ${JSON.stringify(withingsTokens, null, 4)}`);

        if (!withingsTokens || withingsTokens.status !== 'success') {
            utils.debugError(`Error acquiring Withings tokens: ${JSON.stringify(withingsTokens, null, 2)}`);
            if (PUSHOVER) utils.sendPushoverMessage(`Error acquiring Withings tokens: ${JSON.stringify(withingsTokens, null, 2)}`);
            return;
        }

        const withingsData = await fetchWithingsData(withingsTokens.data.access_token, startDay);
        utils.debugLog(`withingsData: ${JSON.stringify(withingsData, null, 4)}`);

        if (!withingsData) {
            utils.debugError('Failed to fetch Withings data');
            if (PUSHOVER) utils.sendPushoverMessage('Failed to fetch Withings data');
            return;
        }

        if (!withingsData.measuregrps || withingsData.measuregrps.length === 0) {
            utils.debugLog('No weight data to log today.');
            if (DEBUG && PUSHOVER) utils.sendPushoverMessage('No weight data to log today.');
            return;
        }

        const inputData = parseWithingsData(withingsData);

        const fitbitTokens = await returnFitbitTokens();
        utils.debugLog(`fitbitTokens: ${JSON.stringify(fitbitTokens.data, null, 4)}`);

        if (!fitbitTokens || fitbitTokens.status !== 'success') {
            utils.debugError(`Error acquiring Fitbit tokens: ${JSON.stringify(fitbitTokens, null, 2)}`);
            if (PUSHOVER) utils.sendPushoverMessage(`Error acquiring Fitbit tokens: ${JSON.stringify(fitbitTokens, null, 2)}`);
            return;
        }

        const token = fitbitTokens.data.access_token;
        const weightPromise = inputData.weight !== undefined
            ? postFitbitLog(token, 'weight', { weight: inputData.weight, date: inputData.date, time: inputData.time })
            : Promise.resolve(null);
        const fatPromise = inputData.fat !== undefined
            ? postFitbitLog(token, 'fat', { fat: inputData.fat, date: inputData.date, time: inputData.time })
            : Promise.resolve(null);

        const [weightResponse, fatResponse] = await Promise.all([weightPromise, fatPromise]);
        utils.debugLog(weightResponse);
        utils.debugLog(fatResponse);

        if (weightResponse?.status === 201 && (!inputData.fat || fatResponse?.status === 201)) {
            if (PUSHOVER) utils.sendPushoverMessage(`Withings data successfully sent to Fitbit: (Body Fat: ${inputData.fat}, Weight: ${inputData.weight}, Date: ${inputData.date}, Time: ${inputData.time})`);
        } else {
            if (PUSHOVER) utils.sendPushoverMessage(`Error sending Withings data to Fitbit: weight=${weightResponse?.status}, fat=${fatResponse?.status}`);
        }
    } catch (error) {
        utils.debugError(`[update] Unexpected error: ${error}`);
        if (PUSHOVER) utils.sendPushoverMessage(`Unexpected error in update: ${error}`);
    }
}

const rule = new schedule.RecurrenceRule();
rule.tz = TIMEZONE_STRING;
rule.hour = RUN_HOUR;
rule.minute = 0;
rule.second = 0;

if (APP_MODE === 'SCHEDULED') {
    console.log(`App running in scheduled mode (Config: ${RUN_HOUR}:00:00, ${TIMEZONE_STRING})`);
    schedule.scheduleJob(rule, () => update());
} else {
    update();
}
