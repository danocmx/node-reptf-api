const cheerio = require("cheerio");
const request = require("request");


const MAIN_SITE = "https://rep.tf";
const ALIASES = {
    "bans": {
        "stfBans": "scraptf",
        "mpBans": "mptf",
        "bzBans": "bazaar",
        "steamBans": "steam",
        "ppmBans": "ppm",
        "hgBans": "hg",
        "nhsBans": "nhs",
        "stBans": "smt",
        "fogBans": "fog",
        "etf2lBans": "etf2l",
        "bptfBans": "bptf",
        "srBans": "sr"
    },
    "otherinfo": {
        "Profile Created": "profile_creation",
        "Owned Games": "owner_games",
        "TF2 Play Time": "tf2_pt",
        "CSGO Play Time": "csgo_pt",
        "Dota 2 Play Time": "dota2_pt",
        "TF2 Backpack Value": "tf2_bpvalue"
    },
    "steamids": {
        "Name": "name",
        "Community ID": "Steam64ID",
        "Steam 2": "Steam2ID",
        "Steam 3": "Steam3ID",
        "Profile URL": "custom_url",
        "url": "community_url"
    }
}
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
            response.profile.steamids[ ALIASES.steamids[name] ] = property
        }

        $otherinfo = cheerio.load(response.otherinfo);
        response.profile.otherinfo = {}
        
        const otherinfo = response.profile.otherinfo;
        $otherinfo("b").remove().each((_, info) => {
            const infoKey = $otherinfo(info).text().replace(":", "");
            otherinfo[ ALIASES.otherinfo[infoKey.replace(":", "")] ] = null;  // Have to do another replace because for some odd reason CSGO Play Time just still has it
        })

        const otherinfoParsed = $otherinfo.text().trim().match(/(\w+ \d+, \d+)\s(\d+)\s(\d+\shours)\s(\d+\shours)\s(\d+\shours)/);
        const otherinfoKeys = Object.keys(otherinfo);
        
        otherinfoParsed.forEach((info, index) => {
            if (index === 0) return;
            const key = otherinfoKeys[ index-1 ];
            otherinfo[ key.replace(":", "") ] = index === 1 ? Date.parse(info) : info;
        })

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

        const Bans = {}
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
            */
            Bans[ ALIASES.bans[type] ] = ban;
        }

        callback(null, Bans);
    })
}

exports.getUserBans = getUserBans;
exports.getUserProfile = getUserProfile;


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
