'use strict';
module.exports = (function () {

    let http = require('http');
    let https = require('https');
    let path = require('path');
    let zlib = require('zlib');
    let Transform = require('stream').Transform;

    let URL = require('url');

    let defaultLogger = function (info) {};


    let extendStream = function (resultant, Transformer) {
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

        return resultant;
    };
    /**
     * @param opts - {
     *                   baseUrl : 'http://api.fixer.io/latest',
     *                   customLogger : function(){},
     *                   rawResponseCaller : function(a, b){
     *
     *                   },
     *                   retryOnFailure:{
     *                       fail : function(){},
     *                       min : 300.
     *                       max : 600,
     *                       retries : 5,
     *                       backOff : 10 //ms
     *                   },
     *                   respondWithObject : true, //returns headers and request as well
     *                   respondWithProperty : 'data', //returns response property as top level, if set to false it returns full body
     *                   parserFunction : function(data){ return JSON.parse(data) } // optional ( defaults to JSON.parse
     *                   timeout : 4000,
     *                   maxCacheKeys : 10,
     *                   cacheTtl : 500,
     *                   enablePipe : false,
     *                   highWaterMark : 16000//set the high water mark on the transform stream
     *                   cacheByReference : false // if true cache returns back the object returned in itself, does not return a copy, thus is mutable
     *               }
     */
    return function HyperRequest(constructorOpts) {


        let cache = {};
        let cacheKeys = [];
        let maxCacheKeys = typeof constructorOpts.maxCacheKeys === 'number' ? constructorOpts.maxCacheKeys : 100;
        let cacheTtl = typeof constructorOpts.cacheTtl === 'number' ? constructorOpts.cacheTtl : 100;

        let retryOnFail = !!constructorOpts.retryOnFailure;
        let retryFailureLogger = () => {};
        let retryMinCode = 400;
        let retryMaxCode = 600;
        let retryCount = 5;
        let retryBackOff = 100;

        if (retryOnFail) {
            retryFailureLogger = constructorOpts.retryOnFailure.fail || retryFailureLogger;
            retryMinCode = constructorOpts.retryOnFailure.min || retryMinCode;
            retryMaxCode = constructorOpts.retryOnFailure.max || retryMaxCode;
            retryCount = constructorOpts.retryOnFailure.retries || retryCount;
            retryBackOff = constructorOpts.retryOnFailure.backOff || retryBackOff;
        }

        let enablePipe = constructorOpts.enablePipe;
        let respondWithObject = constructorOpts.respondWithObject;

        function clone(data){
            return data?JSON.parse(JSON.stringify(data)):data;
        }

        function addCacheElement(key, value) {
            if(cacheTtl) {
                if (cacheKeys.length >= maxCacheKeys) {
                    delete cache[cacheKeys.shift()];
                }
                cacheKeys.push(key);

                cache[key] = {
                    lastInvokeTimeout: setTimeout(function () {
                        cacheKeys = cacheKeys.filter(testKey => testKey === key);
                        delete cache[key];
                    }, cacheTtl),
                    value: clone(value)
                };
            }
            return value;
        }

        function getCacheElement(key) {
            let value = cache[key] ? cache[key].value : null;
            if(!constructorOpts.cacheByReference){
                value = clone(value);
            }
            return value;
        }


        let url = URL.parse(constructorOpts.baseUrl);

        let log = typeof constructorOpts.customLogger === 'function'?constructorOpts.customLogger:defaultLogger;
        let protocol = (constructorOpts.protocol ? constructorOpts.protocol : url.protocol) || 'http:';
        let baseUrl = url.hostname;
        let baseEndpoint = url.path;
        let port = constructorOpts.port || url.port || (protocol.indexOf('https')>-1?'443':'80');
        let agent = (protocol==='http:')?new http.Agent({ keepAlive: true }):new https.Agent({ keepAlive: true });
        let parserFunction = constructorOpts.parserFunction || JSON.parse;

        let debug = typeof constructorOpts.debug === 'boolean' ? constructorOpts.debug : false;

        let timeout = constructorOpts.timeout || 60000;

        let basicAuthToken = constructorOpts.basicAuthToken;
        let basicAuthSecret = constructorOpts.basicAuthSecret;
        let gzip = typeof constructorOpts.gzip !== 'boolean' ? true : constructorOpts.gzip;
        let failWhenBadCode = typeof constructorOpts.failWhenBadCode !== 'boolean' ? true : constructorOpts.failWhenBadCode;

        let rawResponseCaller = typeof constructorOpts.rawResponseCaller !== 'function' ? function () {
        } : constructorOpts.rawResponseCaller;

        let auditor = function(a,b,c) { process.nextTick(rawResponseCaller, a, b, c) };

        let respondWithProperty = typeof constructorOpts.respondWithProperty !== 'boolean' ? (constructorOpts.respondWithProperty || 'data') : false;//set to false if you want everything!

        let headers = clone({
            'User-Agent': 'request',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding' : gzip?'gzip, deflate':undefined,
            Authorization : basicAuthToken?('Basic ' + (new Buffer(basicAuthToken + ':' + (basicAuthSecret ? basicAuthSecret : ''), 'utf8')).toString('base64')):undefined
        });

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
            return handleCallbackOrPromise('GET', endpoint, options, callback, failure);
        }

        function doPost(endpoint, options, callback, failure) {
            return handleCallbackOrPromise('POST', endpoint, options, callback, failure);
        }

        function doDelete(endpoint, options, callback, failure) {
            return handleCallbackOrPromise('DELETE', endpoint, options, callback, failure);
        }

        function doPut(endpoint, options, callback, failure) {
            return handleCallbackOrPromise('PUT', endpoint, options, callback, failure);
        }

        function doPatch(endpoint, options, callback, failure) {
            return handleCallbackOrPromise('PATCH', endpoint, options, callback, failure);
        }

        function handleCallbackOrPromise(verb, endpoint, options, callback, failure){
            if(typeof endpoint === 'undefined') {
                endpoint = '';
            }

            if(typeof options === 'undefined'){
                options = {};
            }

            let res = makeRequest(verb, endpoint, options);


            if(typeof callback === 'function' && typeof failure === 'function') {
                return res.then(callback, failure);
            }
            else if(typeof options === 'function' && typeof callback === 'function') {
                return res.then(options, callback);
            }
            else if(typeof callback === 'function'){
                return res.then((data) => {callback(null, data)}, (err) => {callback(err)});
            }
            else {
                return res;
            }
        }

        function calcRequestOpts(verb, endpoint, opts, postData) {
            let requestOptions = {
                method: verb,
                protocol: protocol,
                port: port,
                host: baseUrl,
                path: path.join(baseEndpoint || '', endpoint).replace('/?', '?'),
                timeout: timeout,
                agent: (typeof opts.agent === 'boolean') ? opts.agent : agent
            };


            if (typeof opts.headers === 'object') {
                requestOptions.headers = Object.assign({}, headers, opts.headers);
            }
            else {
                requestOptions.headers = headers;
            }

            if (postData) {
                requestOptions.headers = Object.assign({}, requestOptions.headers,
                    {
                        'Content-Length': Buffer.byteLength(postData)
                    });
            }
            if(debug) {
                console.log('request opts', requestOptions);
            }
            return requestOptions;
        }

        let retry = function (verb, endpoint, opts, retrysSoFar) {
            return new Promise( (resolve, reject) => {
                return setTimeout(() => {
                    makeRequest(verb, endpoint, opts).then(resolve, reject);
                }, retryBackOff * (retrysSoFar));
            });
        };


        let failedDueToBadCode = function (statusCode) {
            return (failWhenBadCode && statusCode >= 400) && (retryMaxCode >= statusCode) && (retryMinCode <= statusCode);
        };

        function makeRequest(verb, endpoint, opts) {

            if (typeof opts !== 'object') {
                opts = {};
            }

            if (retryOnFail && typeof opts.retriesAttempted !== 'number') {
                opts.retriesAttempted = 0;
            }

            if (debug) {
                log(verb, endpoint, new Date().getTime());
            }


            const postData = typeof opts.body !== 'undefined' ? JSON.stringify(opts.body) : null;
            let requestOptions = calcRequestOpts(verb, endpoint, opts, postData);

            let cacheKey = JSON.stringify(Object.assign({},requestOptions, { agent : 'cache' }));

            if(cacheTtl) {
                let cacheValue = getCacheElement(cacheKey);
                if (cacheValue) {
                    return new Promise((resolve) => {

                        if (debug) {
                            log(verb, endpoint, new Date().getTime());
                        }

                        resolve(cacheValue);
                    });
                }
            }

            let responseData = [];

            const Transformer = new Transform({
                highWaterMark: (opts && typeof opts.highWaterMark === 'number') ? opts.highWaterMark : 16384 * 16,
                transform(chunk, encoding, callback) {

                    if(enablePipe) {
                        callback(null, chunk);
                    }
                    else {
                        responseData.push(chunk.toString('utf8'));
                        callback(null, null);
                    }

                }
            });


            let resultant = new Promise((resolve, reject) => {

                const req = (protocol.indexOf('https') === -1 ? http : https).request(requestOptions, function responder(response) {

                    if ((typeof response.headers['content-encoding'] === 'string') &&
                        ['gzip', 'deflate'].indexOf(response.headers['content-encoding'].toLowerCase()) !== -1) {
                        response.pipe(zlib.createUnzip()).pipe(Transformer);
                    }
                    else {
                        response.pipe(Transformer);
                    }

                    Transformer.on('finish', () => {

                        let stringedResponse = responseData.join('');
                        let data = 'No Content';
                        if(stringedResponse){
                            let minData = parserFunction(stringedResponse);
                            let shouldReadIn = (!failedDueToBadCode(response.statusCode)&&respondWithProperty);
                            let dOrP = shouldReadIn ? minData[respondWithProperty] : minData;
                            data = respondWithObject?{
                                code: response.statusCode,
                                request: Object.assign({}, requestOptions, {agent : !!requestOptions.agent}),
                                headers: response.headers,
                                cookies: getCookiesFromHeader(response.headers),
                                body: dOrP,
                                retries: opts.retriesAttempted
                            }:dOrP;
                        }

                        process.nextTick(auditor, response, data, response.headers);

                        if (failedDueToBadCode(response.statusCode)) {
                            if(retryOnFail && (opts.retriesAttempted < retryCount)) {
                                return retry(verb, endpoint, opts, opts.retriesAttempted++).then(resolve, reject);
                            }

                            process.nextTick(retryFailureLogger, data, response.headers);

                            return reject(data || new Error('unknown error'));
                        }

                        resolve(addCacheElement(cacheKey, data));
                    });

                    Transformer.on('error', (err) => {
                        log('transform error', err);
                        reject(err || new Error('unknown transform stream error'));
                    });

                });

                let createError = function createError(name){
                    return function (err) {
                        reject(err || new Error(name));
                    };
                };

                req.on('error', createError('error'));
                req.on('timeout', createError('timeout'));

                if (postData) {
                    req.write(postData);
                }
                req.end();
            });

            if(typeof enablePipe === 'boolean' && enablePipe) {
                extendStream(resultant, Transformer);
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