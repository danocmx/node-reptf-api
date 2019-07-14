const cheerio = require("cheerio");
const request = require("request");


const MAIN_SITE = "https://rep.tf";
/* TODO: 
    - add docs
    - add eslint
*/

function getUserProfile(steam64ID, callback) {
    apiCall("POST", "profile", steam64ID, (err, response) => {
        if (err) {
            callback(err);
            return;
        }
        if (!response.hasOwnProperty("profile")) {
            callback(new Error("Malformed response, no profile property found."));
            return;
        }

        const $steamids = cheerio.load(response.steamids);
        const steamids = $steamids("textarea").text().split("\n");
        response.profile.steamids = {}
        for (let i = 0; i < steamids.length; i++) {
            const id = steamids[i];
            if (!id.match(/:\ /)) {
                response.profile.steamids.url = id;
                continue;
            }

            [ name, property ] = id.split(": ");
            response.profile.steamids[name] = property
        }

        $otherinfo = cheerio.load(response.otherinfo);
        response.profile.otherinfo = {}
        /* TODO:
            parse otherinfo property since it's being weird
        */

        callback(null, response.profile);
    })
}

function getUserBans(steam64ID, callback) {
    apiCall("POST", "bans", steam64ID, (err, body) => {
        if (err) {
            callback(err);
            return;
        }

        delete body.success;
        delete body.message;

        for (const type in body) {
            if (!body.hasOwnProperty(type)) {
                continue;
            }
            const ban = body[type];
            delete ban.icons;

            if (ban.banned === false) ban.banned = null;
            else if (ban.banned === "good") ban.banned = false;
            else if (ban.banned == "bad") ban.banned = true;

            /* TODO:
                - parse message property
                - rename ban type names
            */
        }

        callback(null, body);
    })
}

function apiCall(httpsMethod, method, search, callback) {
    const options = {
        url: `${MAIN_SITE}/api/${method}`,
        method: httpsMethod,
        json: true,
        gzip: true,
        qs: {
            str: search
        }
    }

    request(options, (err, response, body) => {
        if (err) {
            callback(err);
            return;
        }

        if (!body) {
            callback(new Error("No body suplied"));
            return;
        }

        if (199 > response.statusCode > 299) {
            callback(new Error(`Bad Error Code: ${response.statusCode}`), body);
            return;
        }

        if (!body.success) {
            callback(new Error(body.message));
            return;
        }

        callback(null, body);
        return;
    })
}


exports.getUserBans = getUserBans;
exports.getUserProfile = getUserProfile;
