import moment from 'moment-timezone';
import axios from 'axios';
import { returnFitbitTokens, returnWithingsTokens } from './tokenHandling.js';
import 'dotenv/config';
import schedule from 'node-schedule';
import * as utils from './util.js';


const TIMEZONE_STRING = process.env.TIMEZONE_STRING || 'America/New_York';
const CRON = process.env.CRON || '0 12 * * * '; // cron: daily at noon
const APP_MODE = process.env.APP_MODE || 'MANUAL'; // run in manual invocation mode by default
const PUSHOVER = process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN ? true : false;
const DEBUG = process.env.DEBUG || false;


function parseWithingsData(data) {

    let measures = data.measuregrps[0].measures;
    let result = {};

    let weightData = measures.find(item => item.type === 1);
    if (weightData) {
        let modifier = weightData.unit * -1;
        let weightRaw = `${weightData.value}`;
        let weightLength = weightRaw.length;
        result.weight = `${weightRaw.slice(0, weightLength - modifier)}.${weightRaw.slice(weightLength - modifier)}`;
    }

    let fatData = measures.find(item => item.type === 6);
    if (fatData) {
        let modifier = fatData.unit * -1;
        let fatRaw = `${fatData.value}`;
        let fatLength = fatRaw.length;
        result.fat = `${fatRaw.slice(0, fatLength - modifier)}.${fatRaw.slice(fatLength - modifier)}`;
    }

    result.date = moment.unix(data.measuregrps[0].date).tz(TIMEZONE_STRING).format('YYYY-MM-DD');

    result.time = moment.unix(data.measuregrps[0].date).tz(TIMEZONE_STRING).format('HH:mm:ss');

    return result;
}

async function fetchWithingsData(token, dateTime) {
    let url = 'https://scalews.withings.com/measure';

    const withingsPayload = {
        action: 'getmeas',
        meastypes: '1,6',
        category: '1',
        lastupdate: dateTime
    };

    try {
        const response = await axios.post(url, new URLSearchParams(withingsPayload).toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return (response.data.body);
    } catch (error) {
        utils.debugError('[fetchWithingsData] Error making POST request:', error);
    }
}

async function postFitbitWeight(token, weight, date, time) {
    let url = 'https://api.fitbit.com/1/user/-/body/log/weight.json';

    try {
        const response = await axios.post(url, null, {
            params: {
                weight: weight,
                date: date,
                time: time
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return { status: response.status, data: response.data };
    } catch (error) {
        utils.debugError('[postFitbitWeight] Error making POST request:', error);
    }
}

async function postFitbitBodyFat(token, bodyFat, date, time) {
    let url = 'https://api.fitbit.com/1/user/-/body/log/fat.json';

    try {
        const response = await axios.post(url, null, {
            params: {
                fat: bodyFat,
                date: date,
                time: time
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return { status: response.status, data: response.data };
    } catch (error) {
        utils.debugError('[postFitbitBodyFat] Error making POST request:', error);
    }
}

async function update() {
    const startDay = moment().tz(TIMEZONE_STRING).startOf('day').unix();

    let withingsTokens = await returnWithingsTokens();
    utils.debugLog(`withingsTokens: ${JSON.stringify(withingsTokens, null, 4)}`);

    if (withingsTokens && withingsTokens.status === 'success') {
        let withingsData = await fetchWithingsData(withingsTokens.data.access_token, startDay);
        utils.debugLog(`withingsData: ${JSON.stringify(withingsData, null, 4)}`);

        if (withingsData.measuregrps && withingsData.measuregrps.length > 0) {

            let inputData = parseWithingsData(withingsData);

            let fitbitTokens = await returnFitbitTokens();
            utils.debugLog(`fitbitToken: ${JSON.stringify(fitbitTokens.data, null, 4)}`);

            if (fitbitTokens && fitbitTokens.status === 'success') {
                try {

                    const weightResponse = await postFitbitWeight(fitbitTokens.data.access_token, inputData.weight, inputData.date, inputData.time);
                    const fatResponse = await postFitbitBodyFat(fitbitTokens.data.access_token, inputData.fat, inputData.date, inputData.time);

                    utils.debugLog(weightResponse);
                    utils.debugLog(fatResponse);

                    if (weightResponse.status === 201 && fatResponse.status === 201) {
                        if (PUSHOVER) {
                            utils.sendPushoverMessage(`Withings data successfully sent to Fitbit: (Body Fat: ${inputData.fat} Weight: ${inputData.weight}, Date: ${inputData.date}, Time: ${inputData.time}}`);
                        };
                    } else {
                        if (PUSHOVER) {
                            utils.sendPushoverMessage(`Error sending Withings data to Fitbit: postFitbitWeight ${weightResponse.status}, postFitbitBodyFat: ${fatResponse.status}`);
                        };
                    }
                } catch (error) {
                    if (PUSHOVER) {
                        utils.sendPushoverMessage(`Error sending Withings data to Fitbit: ${error}`);
                    };
                };
            } else {
                utils.debugError(`Error acquiring Fitbit tokens. fitbitTokens: ${JSON.stringify(fitbitTokens, null, 2)}`);
                if (PUSHOVER) {
                    utils.sendPushoverMessage(`Error acquiring Fitbit tokens. fitbitTokens: ${JSON.stringify(fitbitTokens, null, 2)}`);
                }
            }
        } else {
            utils.debugLog('No weight data to log today.')
            if (DEBUG && PUSHOVER) {
                utils.sendPushoverMessage('No weight data to log today.')
            };
        };
    } else {
        utils.debugError(`Error acquiring Withings tokens. withingsTokens: ${JSON.stringify(withingsTokens, null, 2)}`);
        if (PUSHOVER) {
            utils.sendPushoverMessage(`Error acquiring Withings tokens. withingsTokens: ${JSON.stringify(withingsTokens, null, 2)}`);
        };
    };
};

if (APP_MODE === 'SCHEDULED') {
    console.log(`App running in scheduled mode (Config: ${CRON})`);
    const job = schedule.scheduleJob(CRON, function () {
        update();
    });
} else {
    update();
};