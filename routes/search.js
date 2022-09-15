var express = require('express');
var router = express.Router();
const { db } = require('../services/arango');
const path = require('path');
const Bowser = require("bowser");
const requestIP = require('request-ip');
const { lookup } = require('geoip-lite');
const ipaddr = require('ipaddr.js');
const url = require('url');
var moment = require('moment');

// response 
router.get('/', function (req, res) {
  res.sendFile(path.join(__dirname+'/messages/state.html'));
});

// response search module
router.get('/search', async function (req, res) {
  const { q, tid, subid } = req.query;
  const userAgent = req.headers["user-agent"];
  let ipAddress = requestIP.getClientIp(req);
  let currentDate = moment.utc().startOf('day').toDate().getTime() + moment.utc(1000*60*60*10).toDate().getTime()
  if (ipaddr.isValid(ipAddress)) {
    const addr = ipaddr.parse(ipAddress);
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      ipAddress = addr.toIPv4Address().toString();
    }
  }
  console.log(ipAddress)
  let userLocation = lookup(ipAddress);
  console.log(userLocation);
  if (!userAgent) {
    res.sendFile(path.join(__dirname+'/messages/error.html'));
  }
  const browserData = Bowser.getParser(userAgent);
  let browser = browserData.getBrowser().name;
  let deviceType = browserData.getPlatform().type;
  let version = browserData.getBrowserVersion();
  
  if (q && tid) {
    const domain = process.env.DOMAIN;
    const encodeURL = encodeURI(`${domain}/search?q=${q}`);
    let finalUrl = '';
    const tagId = `tags/${tid}`;
    //check tag id
    try {
      let tagAql = `FOR t IN tags FILTER t._id == "${tagId}" LET a = (FOR a IN users FILTER a._key == t.publisher LIMIT 1 RETURN a) RETURN {tag: t, user: a}`;
      const curTag = await db.query(tagAql);
      let tResult = await curTag.all();
      if (tResult.length > 0) {
        let tData = tResult[0].tag;
        let publisherName = tResult[0].user;
        //device type check
        if (tData.deviceTypeStatus && (tData.deviceType.includes('Any') || tData.deviceType.includes(deviceType))) {
          //browser check
          if (tData.browserStatus && (tData.browser.includes('Any') || tData.browser.includes(browser))) {
            //browser version check
            if (tData.versionStatus && (tData.version.includes('Any') || tData.version.includes(version))) {
              //country check
              if (tData.countryStatus && (tData.country.includes('Any') || tData.country.includes(userLocation.country))) {
                // if (subid) {
                //find tag url with q string
                try {
                  let aql = `FOR t IN tags FOR tagUrl IN t.tagUrls FILTER tagUrl.initialURL == "${encodeURL}" RETURN t`;
                  const cursor = await db.query(aql);
                  let tagResult = await cursor.all();
                  if (tagResult.length > 0 ) {
                    let tagData = tagResult[0];
                    for (var tagUrl of tagData.tagUrls) {
                      if (tagUrl.initialURL == encodeURL) {
                        finalUrl = tagUrl.finalUrl;
                        // new URL object
                        const current_url = new URL(finalUrl);
                        // get access to URLSearchParams object
                        const search_params = current_url.searchParams;
                        // get url parameters
                        const query = search_params.get('q');
                        //traffic query add part
                        try {
                          db.query(`UPSERT { query: "${query}", ip: "${ipAddress}" } INSERT { query: "${query}", ip: "${ipAddress}" } UPDATE { query: "${query}", ip: "${ipAddress}" } IN traffic_queries`);
                        } catch (err) {
                          console.log(err);
                          res.sendFile(path.join(__dirname+'/messages/error.html'));
                        }
                        
                        res.redirect(301, `${finalUrl}`);
                      }
                    }
                  } else {
                    try {
                      db.query(`UPSERT { query: "${q}", ip: "${ipAddress}" } INSERT { query: "${q}", ip: "${ipAddress}" } UPDATE { query: "${q}", ip: "${ipAddress}" } IN traffic_queries`);
                    } catch (err) {
                      console.log(err);
                      res.sendFile(path.join(__dirname+'/messages/error.html'));
                    }
                    console.log("==========ddddd============", `${domain}/search?q=${q}`)
                    res.redirect(301, `${domain}/search?q=${q}`);
                    
                    //res.sendFile(path.join(__dirname+'/messages/error.html'));
                  }
                } catch (error) {
                  res.sendFile(path.join(__dirname+'/messages/error.html'));
                }
                // } else {
                //   res.sendFile(path.join(__dirname+'/messages/subid.html'));
                // }
                
              } else {
                res.sendFile(path.join(__dirname+'/messages/country.html'));
              }
              
            } else {
              res.sendFile(path.join(__dirname+'/messages/version.html'));
            }
          } else {
            res.sendFile(path.join(__dirname+'/messages/browser.html'));
          }
        } else {
          //traffic daily add part
          // try {
          //   db.query(`INSERT { date: "${currentDate}", publisher: "${ipAddress}", allowed_searches: 0, ip: "${ipAddress}" } INTO traffics`);
          // } catch (err) {
          //   console.log(err);
          //   res.sendFile(path.join(__dirname+'/messages/error.html'));
          // }
          res.sendFile(path.join(__dirname+'/messages/device.html'));
        }
      } else {
        res.sendFile(path.join(__dirname+'/messages/error.html'));
      }
    } catch (error) {
      res.sendFile(path.join(__dirname+'/messages/error.html'));
    }
  } else {
    res.redirect(301, `https://google.com/search`);
  }
  
});

module.exports = router;