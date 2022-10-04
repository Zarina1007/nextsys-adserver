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
const client = require('prom-client');
var { getState, setState } = require("../utils/state");

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'nextsys-adserver'
})

// Enable the collection of default metrics
client.collectDefaultMetrics({ register })

// response 
router.get('/', function (req, res) {
  res.sendFile(path.join(__dirname+'/messages/state.html'));
});

//grafana
router.get('/metrics', async (_req, res) => {
  try {
    // Return all metrics the Prometheus exposition format
    res.set('Content-Type', register.contentType);
    let metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err);
  }
});


// response search module
router.get('/search', async function (req, res) {
  const reqObj = req.query;
  const domain = process.env.DOMAIN;
  var googleRedirectUrl = new URL('https://www.google.com/search');
  var domainSearchUrl = new URL(`${domain}/search`);
  var queryList = [];
  for (const [key, value] of Object.entries(reqObj)) {
    if (key !== "tid") {
      queryList.push(value);
      domainSearchUrl.searchParams.append(
        key,
        value
      )
    }
  }
  var queryText = queryList.join(' + ');
  const { tid } = req.query;
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
  
  if (tid) {
    const encodeURL = domainSearchUrl.href;
    // const encodeURL = encodeURI(domainSearchUrl.href);
    setState({
      probability: !getState().probability
    });
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
                  let aql = `FOR t IN tags FILTER t.initialURL == "${encodeURL}" && t._id == "${tagId}" RETURN t`;
                  const cursor = await db.query(aql);
                  let tagResult = await cursor.all();
                  if (tagResult.length > 0 ) {
                    let tagData = tagResult[0];
                    if (tagData.tagUrls.length > 0) {
                      if (tagData.tagUrls.length > 1) {
                        if (getState().probability) {
                          console.log("true")
                          finalUrl = tagData.tagUrls[1].finalUrl;
                          // new URL object
                          const current_url = new URL(finalUrl);
                          // get access to URLSearchParams object
                          const search_params = current_url.searchParams;
                          // get url parameters
                          var query = "";
                          for (const [key, value] of Object.entries(search_params)) {
                            if (key !== "tid") {
                              query = value;
                            }
                          }
                          
                          if (tagData.tagUrls[1].param.length > 0) {
                            const paramType = tagData.tagUrls[1].param[0].paramType;
                            if (paramType == "dynamic") {
                              //traffic query add part
                              try {
                                db.query(`UPSERT { query: "${query}", ip: "${ipAddress}" } INSERT { query: "${query}", ip: "${ipAddress}" } UPDATE { query: "${query}", ip: "${ipAddress}" } IN traffic_queries`);
                              } catch (err) {
                                console.log(err);
                                res.sendFile(path.join(__dirname+'/messages/error.html'));
                              }

                              res.redirect(301, `${finalUrl}`);

                            } else if (paramType == "static") {
                              //traffic query add part
                              try {
                                db.query(`UPSERT { query: "${queryText}", ip: "${ipAddress}" } INSERT { query: "${queryText}", ip: "${ipAddress}" } UPDATE { query: "${queryText}", ip: "${ipAddress}" } IN traffic_queries`);
                              } catch (err) {
                                res.sendFile(path.join(__dirname+'/messages/error.html'));
                              }

                              res.redirect(301, `${finalUrl}`);
                            } 
                          }
                        } else {
                          console.log("false")
                          finalUrl = tagData.tagUrls[0].finalUrl;
                          // new URL object
                          const current_url = new URL(finalUrl);
                          // get access to URLSearchParams object
                          const search_params = current_url.searchParams;
                          // get url parameters
                          var query = "";
                          for (const [key, value] of Object.entries(search_params)) {
                            if (key !== "tid") {
                              query = value;
                            }
                          }
                          
                          if (tagData.tagUrls[0].param.length > 0) {
                            const paramType = tagData.tagUrls[0].param[0].paramType;
                            if (paramType == "dynamic") {
                              //traffic query add part
                              try {
                                db.query(`UPSERT { query: "${query}", ip: "${ipAddress}" } INSERT { query: "${query}", ip: "${ipAddress}" } UPDATE { query: "${query}", ip: "${ipAddress}" } IN traffic_queries`);
                              } catch (err) {
                                console.log(err);
                                res.sendFile(path.join(__dirname+'/messages/error.html'));
                              }

                              res.redirect(301, `${finalUrl}`);

                            } else if (paramType == "static") {
                              //traffic query add part
                              try {
                                db.query(`UPSERT { query: "${queryText}", ip: "${ipAddress}" } INSERT { query: "${queryText}", ip: "${ipAddress}" } UPDATE { query: "${queryText}", ip: "${ipAddress}" } IN traffic_queries`);
                              } catch (err) {
                                res.sendFile(path.join(__dirname+'/messages/error.html'));
                              }

                              res.redirect(301, `${finalUrl}`);
                            } 
                          }
                        }
                      } else {
                        finalUrl = tagData.tagUrls[0].finalUrl;
                        // new URL object
                        const current_url = new URL(finalUrl);
                        // get access to URLSearchParams object
                        const search_params = current_url.searchParams;
                        // get url parameters
                        var query = "";
                        for (const [key, value] of Object.entries(search_params)) {
                          if (key !== "tid") {
                            query = value;
                          }
                        }
                        
                        if (tagData.tagUrls[0].param.length > 0) {
                          const paramType = tagData.tagUrls[0].param[0].paramType;
                          if (paramType == "dynamic") {
                            //traffic query add part
                            try {
                              db.query(`UPSERT { query: "${query}", ip: "${ipAddress}" } INSERT { query: "${query}", ip: "${ipAddress}" } UPDATE { query: "${query}", ip: "${ipAddress}" } IN traffic_queries`);
                            } catch (err) {
                              console.log(err);
                              res.sendFile(path.join(__dirname+'/messages/error.html'));
                            }

                            res.redirect(301, `${finalUrl}`);

                          } else if (paramType == "static") {
                            //traffic query add part
                            try {
                              db.query(`UPSERT { query: "${queryText}", ip: "${ipAddress}" } INSERT { query: "${queryText}", ip: "${ipAddress}" } UPDATE { query: "${queryText}", ip: "${ipAddress}" } IN traffic_queries`);
                            } catch (err) {
                              res.sendFile(path.join(__dirname+'/messages/error.html'));
                            }

                            res.redirect(301, `${finalUrl}`);
                          } 
                        }
                      }
                      
                    } else {
                      try {
                        db.query(`UPSERT { query: "${queryText}", ip: "${ipAddress}" } INSERT { query: "${queryText}", ip: "${ipAddress}" } UPDATE { query: "${queryText}", ip: "${ipAddress}" } IN traffic_queries`);
                      } catch (err) {
                        res.sendFile(path.join(__dirname+'/messages/error.html'));
                      }
                      if (reqObj.length > 2) {
                        var googleUrl = new URL('https://www.google.com/search');
                        var yahooUrl = new URL('https://search.yahoo.com/search');
                        if (getState().probability) {
                          for (const [key, value] of Object.entries(reqObj)) {
                            if (key !== "tid" && key !== "p") {
                              googleUrl.searchParams.append(
                                key,
                                value
                              )
                            }
                          }
                          res.redirect(301, googleUrl.href);
                        } else {
                          for (const [key, value] of Object.entries(reqObj)) {
                            if (key !== "tid" && key !== "q") {
                              yahooUrl.searchParams.append(
                                key,
                                value
                              )
                            }
                          }
                          res.redirect(301, yahooUrl.href);
                        }
                      } else {
                        for (const [key, value] of Object.entries(reqObj)) {
                          if (key !== "tid") {
                            googleRedirectUrl.searchParams.append(
                              key,
                              value
                            )
                          }
                        }
                        console.log("==========after============", googleRedirectUrl.href)
                        res.redirect(301, googleRedirectUrl.href);
                      }
                      
                      
                    }
                  } else {
                    try {
                      db.query(`UPSERT { query: "${queryText}", ip: "${ipAddress}" } INSERT { query: "${queryText}", ip: "${ipAddress}" } UPDATE { query: "${queryText}", ip: "${ipAddress}" } IN traffic_queries`);
                    } catch (err) {
                      res.sendFile(path.join(__dirname+'/messages/error.html'));
                    }
                    if (reqObj.length > 2) {
                      console.log("==========input=======");
                      var googleUrl = new URL('https://www.google.com/search');
                      var yahooUrl = new URL('https://search.yahoo.com/search');
                      if (getState().probability) {
                        for (const [key, value] of Object.entries(reqObj)) {
                          if (key !== "tid" && key !== "p") {
                            googleUrl.searchParams.append(
                              key,
                              value
                            )
                          }
                        }
                        console.log("==========google=======", getState().probability);
                        res.redirect(301, googleUrl.href);
                      } else {
                        console.log("==========yahoo=======", getState().probability);
                        for (const [key, value] of Object.entries(reqObj)) {
                          if (key !== "tid" && key !== "q") {
                            yahooUrl.searchParams.append(
                              key,
                              value
                            )
                          }
                        }
                        res.redirect(301, yahooUrl.href);
                      }
                    } else {
                      for (const [key, value] of Object.entries(reqObj)) {
                        if (key !== "tid") {
                          googleRedirectUrl.searchParams.append(
                            key,
                            value
                          )
                        }
                      }
                      console.log("==========after============", googleRedirectUrl.href)
                      res.redirect(301, googleRedirectUrl.href);
                    }
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
        res.sendFile(path.join(__dirname+'/messages/tag.html'));
      }
    } catch (error) {
      console.log("=================", error);
      res.sendFile(path.join(__dirname+'/messages/error.html'));
    }
  } else {
    res.redirect(301, googleRedirectUrl.href);
  }
  
});

module.exports = router;