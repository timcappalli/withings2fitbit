import axios from 'axios';
import fs from 'fs';
import * as utils from './util.js';


const WITHINGS_CLIENT_ID = process.env.WITHINGS_CLIENT_ID || null;
const WITHINGS_CLIENT_SECRET = process.env.WITHINGS_CLIENT_SECRET || null;
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID || null;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET || null;

if (!WITHINGS_CLIENT_ID || !WITHINGS_CLIENT_SECRET || !FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET) {
    throw new Error('Missing required environment variables');
}

function writeToJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        utils.debugLog(`Successfully wrote to ${filePath}`);
    } catch (err) {
        utils.debugError('Error writing to JSON file:', err);
    }
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
    const params = new URLSearchParams({
        action: 'requesttoken',
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });
    try {
        const response = await axios.post('https://wbsapi.withings.net/v2/oauth2', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    } catch (error) {
        utils.debugError(error);
    }
}

async function getFitbitAccessToken(refreshToken, clientId) {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId
    });
    try {
        const response = await axios.post('https://api.fitbit.com/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    } catch (error) {
        utils.debugError(error);
    }
}

export async function returnWithingsTokens() {
    const cachedTokens = readJsonFile('withings-cache.json');

    let withingsRefreshToken;

    if (cachedTokens && cachedTokens.refresh_token) {
        withingsRefreshToken = cachedTokens.refresh_token;
        utils.debugLog('[returnWithingsTokens] using cached withings RT');
    } else if (process.env.WITHINGS_REFRESH_TOKEN) {
        withingsRefreshToken = process.env.WITHINGS_REFRESH_TOKEN;
        utils.debugLog('[returnWithingsTokens] using withings RT from ENV');
    } else {
        return { status: 'error', msg: 'No Withings refresh token found', data: {} };
    }

    const withingsTokenResponse = await getWithingsAccessToken(withingsRefreshToken, WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET);
    utils.debugLog(`withingsTokenResponse: ${JSON.stringify(withingsTokenResponse, null, 4)}`);

    if (withingsTokenResponse && withingsTokenResponse.status === 0) {
        writeToJsonFile('withings-cache.json', withingsTokenResponse.body);
        return { status: 'success', msg: '', data: withingsTokenResponse.body };
    } else {
        utils.debugError('[returnWithingsTokens] Failed to retrieve Withings tokens');
        return { status: 'error', msg: 'Failed to retrieve Withings tokens', data: {} };
    }
}

export async function returnFitbitTokens() {
    const cachedTokens = readJsonFile('fitbit-cache.json');

    let fitbitRefreshToken;

    if (cachedTokens && cachedTokens.refresh_token) {
        fitbitRefreshToken = cachedTokens.refresh_token;
        utils.debugLog('[returnFitbitTokens] using cached fitbit RT');
    } else if (process.env.FITBIT_REFRESH_TOKEN) {
        fitbitRefreshToken = process.env.FITBIT_REFRESH_TOKEN;
        utils.debugLog('[returnFitbitTokens] using Fitbit RT from ENV');
    } else {
        return { status: 'error', msg: 'No Fitbit refresh token found', data: {} };
    }

    const fitbitTokenResponse = await getFitbitAccessToken(fitbitRefreshToken, FITBIT_CLIENT_ID);
    if (fitbitTokenResponse) {
        writeToJsonFile('fitbit-cache.json', fitbitTokenResponse);
        return { status: 'success', msg: '', data: fitbitTokenResponse };
    } else {
        utils.debugError('[returnFitbitTokens] Failed to retrieve Fitbit tokens');
        return { status: 'error', msg: 'Failed to retrieve Fitbit tokens', data: {} };
    }
}
