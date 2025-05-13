import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';
import * as utils from './util.js';


const WITHINGS_CLIENT_ID = process.env.WITHINGS_CLIENT_ID || null;
const WITHINGS_CLIENT_SECRET = process.env.WITHINGS_CLIENT_SECRET || null;
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID || null;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET || null;

if (!WITHINGS_CLIENT_ID || !WITHINGS_CLIENT_SECRET || !FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET) {
    throw new Error('Missing required environment variables');
}

function writeToJsonFile(filePath, data) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) {
            utils.debugError('Error writing to JSON file:', err);
        } else {
            utils.debugLog(`Successfully wrote to ${filePath}`);
        }
    });
}

function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        utils.debugError('Error reading JSON file:', err);
        return null;
    }
}

async function getWithingsAccessToken(refreshToken, clientId, clientSecret) {
    let data = {
        'action': 'requesttoken',
        'client_id': clientId,
        'client_secret': clientSecret,
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken
    }

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://wbsapi.withings.net/v2/oauth2',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams(data)
    };

    try {
        const response = await axios.request(config);
        return response.data;
    } catch (error) {
        utils.debugError(error);
    }
};

async function getFitbitAccessToken(refreshToken, clientId) {
    let data = {
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': clientId
    }

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.fitbit.com/oauth2/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams(data)
    };

    try {
        const response = await axios.request(config);
        return response.data;
    } catch (error) {
        utils.debugError(error);
    }
};

export async function returnWithingsTokens() {
    const cachedTokens = readJsonFile('withings-cache.json');

    let withingsRefreshToken;
    let withingsTokens = {};

    if (cachedTokens && cachedTokens.refresh_token) {
        withingsRefreshToken = cachedTokens.refresh_token;
        utils.debugLog('[returnWithingsTokens] using cached withings RT');
    } else if (process.env.WITHINGS_REFRESH_TOKEN) {
        withingsRefreshToken = process.env.WITHINGS_REFRESH_TOKEN;
        utils.debugLog('[returnWithingsTokens] using withings RT from ENV');
    } else {
        throw new Error('No Withings refresh token found');
    };

    let withingsTokenResponse = await getWithingsAccessToken(withingsRefreshToken, WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET);
    utils.debugLog(`withingsTokenResponse: ${JSON.stringify(withingsTokenResponse, null, 4)}`)
    
    if (withingsTokenResponse && withingsTokenResponse.status == 0) {
        writeToJsonFile('withings-cache.json', withingsTokenResponse.body);
        withingsTokens = withingsTokenResponse.body;
    } else {
        utils.sendPushoverMessage('[returnWithingsTokens] Failed to retrieve Withings tokens');
        utils.debugError('[returnWithingsTokens] Failed to retrieve Withings tokens');
        return { status: "error", msg: "[returnWithingsTokens] Failed to retrieve Withings tokens", data: {}};
    }

    //return withingsTokens;
    return { status: "success", msg: "", data: withingsTokens}
}

export async function returnFitbitTokens() {
    const cachedTokens = readJsonFile('fitbit-cache.json');

    let fitbitTokens;
    let fitbitRefreshToken;

    if (cachedTokens && cachedTokens.refresh_token) {
        fitbitRefreshToken = cachedTokens.refresh_token;
        utils.debugLog('[returnFitbitTokens] using cached fitbit RT');

    } else if (process.env.FITBIT_REFRESH_TOKEN) {
        fitbitRefreshToken = process.env.FITBIT_REFRESH_TOKEN;
        utils.debugLog('[returnFitbitTokens] using Fitbit RT from ENV');
    } else {
        throw new Error('No Fitbit refresh token found');
    };

    let fitbitTokenResponse = await getFitbitAccessToken(fitbitRefreshToken, FITBIT_CLIENT_ID);
    if (fitbitTokenResponse) {
        writeToJsonFile('fitbit-cache.json', fitbitTokenResponse);
        fitbitTokens = fitbitTokenResponse;
    } else {
        utils.sendPushoverMessage('[returnFitbitTokens] Failed to retrieve Fitbit tokens')
        utils.debugError('[returnFitbitTokens] Failed to retrieve Fitbit tokens')
        return { status: "error", msg: "Failed to retrieve Fitbit tokens", data: {}};
    }

    return { status: "success", msg: "", data: fitbitTokens};
}