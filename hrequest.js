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

    let defaultLogger = function (info) {};

    let URL = require('url');

    /**
     * @param opts - { protocol : 'http://', baseUrl : 'fixer.io' }
     */
    return function HyperRequest(opts) {

        let cache = {};
        let cacheKeys = [];
        let maxCacheKeys = typeof opts.maxCacheKeys === 'number'?opts.maxCacheKeys: 100;
        let cacheTtl = typeof opts.cacheTtl ==='number'?opts.cacheTtl : 100;

        function addCacheElement(key, value){
            if(cacheKeys.length >= maxCacheKeys){
                delete cache[cacheKeys.shift()];
            }
            cacheKeys.push(key);

            cache[key] = {
                lastInvokeTimeout : setTimeout(function(){
                    cacheKeys = cacheKeys.filter(testKey => testKey === key);
                    delete cache[key];
                }, cacheTtl),
                value : value
            };
        }

        function getCacheElement(key){
            return cache[key]?cache[key].value:null;
        }


        let url = URL.parse(opts.baseUrl);

        let log = defaultLogger;
        let protocol = opts.protocol ? opts.protocol : url.protocol;
        let baseUrl = url.host;
        let baseEndpoint = url.path;

        let debug = typeof opts.debug === 'boolean'? opts.debug : false;

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

            if(debug){
                log(verb, endpoint, new Date().getTime());
            }

            function asynchronize(func) {
                if (typeof func === 'function') {
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
                host: baseUrl,
                path: path.join(baseEndpoint || '', endpoint).replace('/?', '?'),
                timeout: timeout
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

            let cacheValue = getCacheElement(JSON.stringify(requestOptions));
            if(cacheValue){
                return new Promise((resolve) => {

                    if(debug){
                        log(verb, endpoint, new Date().getTime());
                    }

                    success(respondWithProperty ? cacheValue[respondWithProperty] : cacheValue);
                    resolve(respondWithProperty ? cacheValue[respondWithProperty] : cacheValue);
                });
            }

            let responseData = '';

            const Transformer = new Transform({
                transform(chunk, encoding, callback) {
                    responseData += chunk.toString('utf8');
                    callback(null, chunk);
                }
            });

            let resultant = new Promise((resolve, reject) => {

                let responseCode;
                let responseHeaders;

                const req = (protocol.indexOf('https') === -1?http:https).request(requestOptions,
                    function (response) {

                        responseCode = response.statusCode;

                        responseHeaders = response.headers;

                        if (['gzip', 'deflate'].indexOf(response.headers['content-encoding']) !== -1) {
                            response.pipe(zlib.createUnzip()).pipe(Transformer);
                        }
                        else {
                            response.pipe(Transformer);
                        }

                        Transformer.on('finish', () => {
                            let data = JSON.parse(responseData);

                            asyncResponseCaller(response, data, responseHeaders);

                            if (failWhenBadCode && responseCode >= 400) {
                                failure(responseData, responseHeaders);
                                reject(responseData, responseHeaders);
                            }
                            else {
                                if(cacheTtl){
                                    addCacheElement(cacheValue, data);
                                }

                                if(debug){
                                    log(verb, endpoint, new Date().getTime());
                                }

                                success(respondWithProperty ? data[respondWithProperty] : data, responseHeaders, data);
                                resolve(respondWithProperty ? data[respondWithProperty] : data, responseHeaders, data);
                            }
                        });
                    }
                );

                req.on('error', (err) => {

                    if(debug){
                        log(verb, endpoint, new Date().getTime());
                    }

                    asyncResponseCaller(req);
                    failure(err);
                    reject(err);
                });

                req.on('timeout', () => {

                    if(debug){
                        log(verb, endpoint, new Date().getTime());
                    }

                    let error = new Error('timeout');
                    asyncResponseCaller(error);
                    failure(error);
                    reject(error);
                });

                if (postData) {
                    req.write(postData);
                }
                req.end();
            });

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