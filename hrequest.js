'use strict';
module.exports = (function () {

    let http = require('http');
    let https = require('https');
    let path = require('path');
    let zlib = require('zlib');
    let Transform = require('stream').Transform;
    const util = require('util');

    const GET = 'GET';
    const PATCH = 'PATCH';
    const POST = 'POST';
    const PUT = 'PUT';
    const DELETE = 'DELETE';

    let defaultLogger = function (info) {
    };

    function spreader() {
        let argz = arguments;
        let result = function (a, b, c, d, e, f) {
            for (let i = 0; i < argz.length; ++i) {
                if (typeof argz[i] === 'function') {
                    argz[i](a, b, c, d, e, f)//.apply(arguments);
                }
            }
        };
        result.isSpreaderFunctions = true;
        return result;
    }

    let URL = require('url');

    /**
     * @param opts - { protocol : 'http://', baseUrl : 'fixer.io' }
     */
    return function HyperRequest(opts) {

        let cache = {};
        let cacheKeys = [];
        let maxCacheKeys = typeof opts.maxCacheKeys === 'number' ? opts.maxCacheKeys : 100;
        let cacheTtl = typeof opts.cacheTtl === 'number' ? opts.cacheTtl : 100;

        let retryOnFailure = !!opts.retryOnFailure;
        let retryFailure = () => {
        };
        let retryMinCode = 400;
        let retryMaxCode = 600;
        let retryCount = 5;
        let retryBackOff = 100;
        if (retryOnFailure) {
            retryFailure = opts.retryOnFailure.fail || retryFailure;
            retryMinCode = opts.retryOnFailure.min || retryMinCode;
            retryMaxCode = opts.retryOnFailure.max || retryMaxCode;
            retryCount = opts.retryOnFailure.retries || retryCount;
            retryBackOff = opts.retryOnFailure.backOff || retryBackOff;
        }

        let disablePipe = opts.disablePipe;
        let respondWithObject = opts.respondWithObject;

        function addCacheElement(key, value) {
            if (cacheKeys.length >= maxCacheKeys) {
                delete cache[cacheKeys.shift()];
            }
            cacheKeys.push(key);

            cache[key] = {
                lastInvokeTimeout: setTimeout(function () {
                    cacheKeys = cacheKeys.filter(testKey => testKey === key);
                    delete cache[key];
                }, cacheTtl),
                value: value
            };
        }

        function getCacheElement(key) {
            let value = cache[key] ? cache[key].value : null;
            if(!opts.cacheByReference){
                value = JSON.parse(JSON.stringify(value));
            }
            return value;
        }


        let url = URL.parse(opts.baseUrl);

        let log = defaultLogger;
        let protocol = (opts.protocol ? opts.protocol : url.protocol) || 'http:';
        let baseUrl = url.hostname;
        let baseEndpoint = url.path;
        let port = opts.port || url.port || (protocol.indexOf('https')>-1?'443':'80');

        let parserFunction = opts.parserFunction || JSON.parse;

        let debug = typeof opts.debug === 'boolean' ? opts.debug : false;

        let timeout = opts.timeout || 60000;

        let basicAuthToken = opts.basicAuthToken;
        let basicAuthSecret = opts.basicAuthSecret;
        let gzip = typeof opts.gzip !== 'boolean' ? true : opts.gzip;
        let failWhenBadCode = typeof opts.failWhenBadCode !== 'boolean' ? true : opts.failWhenBadCode;

        let rawResponseCaller = typeof opts.rawResponseCaller !== 'function' ? function () {
        } : opts.rawResponseCaller;

        let respondWithProperty = typeof opts.respondWithProperty !== 'boolean' ? (opts.respondWithProperty || 'data') : false;//set to false if you want everything!

        if (opts.customLogger) {
            log = opts.customLogger;
        }

        let headers = {
            'User-Agent': 'request',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (gzip) {
            headers['Accept-Encoding'] = 'gzip, deflate';
        }

        if (basicAuthToken) {
            headers.Authorization = 'Basic ' + (new Buffer(basicAuthToken + ':' + (basicAuthSecret ? basicAuthSecret : ''), 'utf8')).toString('base64');//'Basic ' + btoa(basicAuthToken+':');
        }

        //this temporarily changes the headers
        function extendHeaders(headers, internalHeaders) {
            for (var h in internalHeaders) {
                headers[h] = internalHeaders[h];
            }
            return headers;
        }

        //more perminant for this instance
        function setHeader(key, value) {
            headers[key] = value;
        }

        function getCookiesFromHeader(headers) {

            if (!headers || !headers.cookie) {
                return {};
            }

            return headers.cookie.split(';').reduce((cookies, cookie) => {
                let parts = cookie.split('=');
                let key = parts.shift().trim();
                if (key !== '') {
                    cookies[key] = decodeURI(parts.join('='));
                }
                return cookies;
            }, {});

        }

        function doGet(endpoint, options, callback, failure) {
            return this.makeRequest(GET, endpoint, options, callback, failure);
        }

        function doPost(endpoint, options, callback, failure) {
            return this.makeRequest(POST, endpoint, options, callback, failure);
        }

        function doDelete(endpoint, options, callback, failure) {
            return this.makeRequest(DELETE, endpoint, options, callback, failure);
        }

        function doPut(endpoint, options, callback, failure) {
            return this.makeRequest(PUT, endpoint, options, callback, failure);
        }

        function doPatch(endpoint, options, callback, failure) {
            return this.makeRequest(PATCH, endpoint, options, callback, failure);
        }

        function makeRequest(verb, endpoint, opts, ok, fail) {

            if (!opts) {
                opts = {};
            }

            if (retryOnFailure && typeof opts.retriesAttempted !== 'number') {
                opts.retriesAttempted = 0;
            }

            if (debug) {
                log(verb, endpoint, new Date().getTime());
            }

            function asynchronize(func) {
                if (typeof func === 'function') {
                    if (func.isSpreaderFunctions) {
                        return func;//its already async and also a spread function
                    }
                    return function async(data, data2, data3) {
                        process.nextTick(func, data, data2, data3);
                    };
                }
                return function () {
                };
            }

            let success = asynchronize(ok);
            let failure = asynchronize(fail);
            let asyncResponseCaller = asynchronize(rawResponseCaller);

            let requestOptions = {
                method: verb,
                protocol: protocol,
                port : port,
                host: baseUrl,
                path: path.join(baseEndpoint || '', endpoint).replace('/?', '?'),
                timeout: timeout,
                agent: typeof opts.agent === 'boolean' ? opts.agent : false
            };


            if (opts.headers) {
                requestOptions.headers = extendHeaders(opts.headers, headers);
            }
            else {
                requestOptions.headers = headers;
            }

            const postData = opts.body ? JSON.stringify(opts.body) : null;

            if (postData) {
                requestOptions.headers = extendHeaders(requestOptions.headers,
                    {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    });
            }

            let cacheKey = JSON.stringify(requestOptions);

            if(cacheTtl) {
                let cacheValue = getCacheElement(cacheKey);
                if (cacheValue) {
                    return new Promise((resolve) => {

                        if (debug) {
                            log(verb, endpoint, new Date().getTime());
                        }

                        success(cacheValue);
                        resolve(cacheValue);
                    });
                }
            }

            let responseData = [];

            const Transformer = new Transform({
                highWaterMark: (opts && opts.highWaterMark) ? opts.highWaterMark : 16384 * 16,
                transform(chunk, encoding, callback) {
                    let items = chunk.toString('utf8');
                    responseData.push(items);

                    if (debug) {
                        log('chunk', items);
                    }

                    callback(null, disablePipe ? null : chunk);
                }
            });

            let resultant = new Promise((resolve, reject) => {


                let goodCB = success.isSpreaderFunctions ? success : spreader(resolve, success);
                let badCB = failure.isSpreaderFunctions ? failure : spreader(reject, failure);

                let responseCode;
                let responseHeaders;

                function responder(response) {

                    responseCode = response.statusCode;

                    responseHeaders = response.headers;

                    let contentEncoding = response.headers['content-encoding'];
                    if(typeof contentEncoding === 'string'){
                        contentEncoding = contentEncoding.toLowerCase();
                    }

                    if (contentEncoding && ['gzip', 'deflate'].indexOf(contentEncoding) !== -1) {
                        response.pipe(zlib.createUnzip()).pipe(Transformer);
                    }
                    else {
                        response.pipe(Transformer);
                    }

                    Transformer.on('finish', () => {
                        let data = null;
                        try {
                            let stringedResponse = responseData.join('');
                            let minData = '';

                            if(stringedResponse){
                                minData = parserFunction(stringedResponse);
                            }
                            else {
                                if (debug) {
                                    log('raw response data', responseData, response.statusCode, response.headers);
                                }
                                throw new Error('No Content');
                            }

                            if (respondWithObject) {
                                data = {
                                    code: response.statusCode,
                                    request: requestOptions,
                                    headers: response.headers,
                                    cookies: getCookiesFromHeader(response.headers),
                                    body: respondWithProperty ? minData[respondWithProperty] : minData,
                                    retries: opts.retriesAttempted
                                };
                            }
                            else {
                                data = minData;
                                // data = respondWithProperty?minData[respondWithProperty]:minData;
                            }
                        }
                        catch (e) {

                            if (debug) {
                                log('raw response data', responseData);
                            }

                            if(retryOnFailure && opts.retriesAttempted < retryCount) {
                                setTimeout(() => {
                                    makeRequest(verb, endpoint, opts, goodCB, badCB);
                                }, retryBackOff * opts.retriesAttempted);
                                return;
                            }
                            else {
                                return badCB(e)
                            }
                        }

                        asyncResponseCaller(response, data, responseHeaders);

                        if (failWhenBadCode && responseCode >= 400) {
                            opts.retriesAttempted++;

                            if (retryOnFailure && (retryMaxCode >= responseCode) && (retryMinCode <= responseCode) && (opts.retriesAttempted < retryCount)) {

                                setTimeout(() => {
                                    makeRequest(verb, endpoint, opts, goodCB, badCB);
                                }, retryBackOff * opts.retriesAttempted);
                                return;

                            }
                            else {
                                if (retryOnFailure && responseCode <= retryMaxCode && responseCode >= retryMinCode) {
                                    retryFailure(data, responseHeaders);
                                }
                                badCB(data, responseHeaders, responseCode);
                            }
                        }
                        else {
                            if (cacheTtl) {
                                addCacheElement(cacheKey, data);
                            }

                            if (debug) {
                                log(verb, endpoint, new Date().getTime());
                            }

                            let r = (!respondWithObject&&respondWithProperty)?data[respondWithProperty]:data;

                            goodCB(r, responseHeaders, r, responseCode);
                        }
                    });

                    Transformer.on('error', (err) => {
                        log('transform error', err);
                        badCB(err);
                    });

                }

                if (debug) {
                    log(requestOptions);
                }

                const req = (protocol.indexOf('https') === -1 ? http : https).request(requestOptions, responder);

                req.on('error', (err) => {

                    if (debug) {
                        log(verb, endpoint, new Date().getTime());
                    }

                    asyncResponseCaller(req);
                    badCB(err);
                });

                req.on('timeout', () => {

                    if (debug) {
                        log(verb, endpoint, new Date().getTime());
                    }

                    let error = new Error('timeout');
                    asyncResponseCaller(error);
                    badCB(error);
                });

                if (postData) {
                    req.write(postData);
                }
                req.end();
            });

            if(!disablePipe) {
                Object.assign(resultant, Transformer);

                //hack!
                resultant.pipe = Transformer.pipe;
                resultant.once = Transformer.once;
                resultant.on = Transformer.on;
                resultant.resume = Transformer.resume;
                resultant.read = Transformer.read;
                resultant.write = Transformer.write;
                resultant._read = Transformer._read;
                resultant._write = Transformer._write;
                resultant.emit = Transformer.emit;
                resultant.removeListener = Transformer.removeListener;
                resultant.unpipe = Transformer.unpipe;
                resultant.pause = Transformer.pause;
            }

            return resultant;
        }

        return {

            setHeader: setHeader,


            get: doGet,
            post: doPost,
            put: doPut,
            patch: doPatch,
            delete: doDelete,


            //incase those other calls dont work for you
            makeRequest: makeRequest
        };
    }

})();