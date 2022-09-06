var express = require('express');
var router = express.Router();
const { db } = require('../services/arango');
const path = require('path');
const Bowser = require("bowser");
const requestIP = require('request-ip');
const { lookup } = require('geoip-lite');
const ipaddr = require('ipaddr.js');

// response 
router.get('/', function (req, res) {
  res.sendFile(path.join(__dirname+'/messages/state.html'));
});

// response search module
router.get('/search', async function (req, res) {
  const { q, tid, subid } = req.query;
  const userAgent = req.headers["user-agent"];
  let ipAddress = requestIP.getClientIp(req);
  
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
      let tagAql = `FOR t IN tags FILTER t._id == "${tagId}" RETURN t`;
      const curTag = await db.query(tagAql);
      let tResult = await curTag.all();
      if (tResult.length > 0) {
        let tData = tResult[0];
        console.log(tData.browser, browser, deviceType, version, "====d=")
        if (tData.deviceTypeStatus && (tData.deviceType.includes('Any') || tData.deviceType.includes(deviceType))) {
          if (tData.browserStatus && (tData.browser.includes('Any') || tData.browser.includes(browser))) {
            if (tData.versionStatus && (tData.version.includes('Any') || tData.version.includes(version))) {
              if (tData.countryStatus && (tData.country.includes('Any') || tData.country.includes(userLocation.country))) {
                if (subid) {
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
                          res.redirect(301, `${finalUrl}`);
                        }
                      }
                    } else {
                      res.sendFile(path.join(__dirname+'/messages/error.html'));
                    }
                  } catch (error) {
                    res.sendFile(path.join(__dirname+'/messages/error.html'));
                  }
                } else {
                  res.sendFile(path.join(__dirname+'/messages/subid.html'));
                }
                
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