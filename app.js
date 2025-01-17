import moment from 'moment-timezone';
import axios from 'axios';
import { returnFitbitTokens, returnWithingsTokens } from './tokenHandling.js';
import 'dotenv/config';
import PushOver from 'pushover-notifications';
import schedule from 'node-schedule';
import * as utils from './util.js';

//testing only
//import withingsTestData from './samples/withings.json' with { type: "json" };
//testing only//

const PUSHOVER_USER = process.env.PUSHOVER_USER || null;
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN || null;
const TIMEZONE_STRING = process.env.TIMEZONE_STRING || 'America/New_York';
const CRON = process.env.CRON || '0 12 * * * ';




var pusher = new PushOver({
    user: PUSHOVER_USER,
    token: PUSHOVER_TOKEN,
});

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

    let withingsData = await fetchWithingsData(withingsTokens.access_token, startDay);
    utils.debugLog(`withingsData: ${JSON.stringify(withingsTokens, null, 4)}`);

    if (withingsData.measuregrps && withingsData.measuregrps.length > 0) {

        let inputData = parseWithingsData(withingsData);

        let fitbitToken = await returnFitbitTokens();
        utils.debugLog(`fitbitToken: ${JSON.stringify(fitbitToken, null, 4)}`);

        try {

            const weightResponse = await postFitbitWeight(fitbitToken.access_token, inputData.weight, inputData.date, inputData.time);
            const fatResponse = await postFitbitBodyFat(fitbitToken.access_token, inputData.fat, inputData.date, inputData.time);

            utils.debugLog(weightResponse);
            utils.debugLog(fatResponse);

            if (weightResponse.status === 201 && fatResponse.status === 201) {

                let pMsg = { message: `Withings data successfully sent to Fitbit: (Body Fat: ${inputData.fat} Weight: ${inputData.weight}, Date: ${inputData.date}, Time: ${inputData.time}}`, title: "Withings2Fitbit" }
                pusher.send(pMsg, function (err, result) {
                    if (err) {
                        throw err
                    }
                });
            } else {
                let pMsg = { message: `Error sending Withings data to Fitbit: postFitbitWeight ${weightResponse.status}, postFitbitBodyFat: ${fatResponse.status}`, title: "Withings2Fitbit" }
                pusher.send(pMsg, function (err, result) {
                    if (err) {
                        throw err
                    }
                });
            }
        } catch (error) {
            let pMsg = { message: `Error sending Withings data to Fitbit: ${error}`, title: "Withings2Fitbit" }
            pusher.send(pMsg, function (err, result) {
                if (err) {
                    throw err
                }
            });
        }
    } else {
        utils.debugLog('No weight data to log today.')
        if (DEBUG) {
            let pMsg = { message: `No weight data to log today.`, title: "Withings2Fitbit" }
            pusher.send(pMsg, function (err, result) {
                if (err) {
                    throw err
                }
            });
        }
    }
};

const job = schedule.scheduleJob(CRON, function () {
    update();
});