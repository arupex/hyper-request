'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const Transform = require('stream').Transform;
const URL = require('url');

const deepValue = require('deep-value');
const deepSet = require('deep-setter');

const defaultLogger = function (info) {};

class SubClient {

    constructor(config) {
        if (!config.parentClient) {
            throw new Error('needs parentClient');
        }

        this._url = config.url || '';
        this._headers = config.headers || {};
        this._parentClient = config.parentClient;
        this._auditor = config.auditor;
        this._requestExtender = (typeof config.requestExtender === 'function') ? config.requestExtender : (r) => r;
    }

    opts(options){
      return this._requestExtender(Object.assign({}, {
          auditor : this._auditor,
          headers : this._headers
      }, options));
    }

    get(endpoint, options, callback, failure) {
        return this._parentClient.get(path.join(this._url, endpoint), this.opts(options), callback, failure);
    }

    post(endpoint, options, callback, failure) {
        return this._parentClient.post(path.join(this._url, endpoint), this.opts(options), callback, failure);
    }

    delete(endpoint, options, callback, failure) {
        return this._parentClient.delete(path.join(this._url, endpoint), this.opts(options), callback, failure);
    }

    put(endpoint, options, callback, failure) {
        return this._parentClient.put(path.join(this._url, endpoint), this.opts(options), callback, failure);
    }

    patch(endpoint, options, callback, failure) {
        return this._parentClient.patch(path.join(this._url, endpoint), this.opts(options), callback, failure);
    }
}

class HyperRequest {

    /**
     * @param opts - {
     *                   baseUrl : 'http://api.fixer.io/latest',
     *                   customLogger : function(){},
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
    constructor(config) {

        this.clearCache();

        this.maxCacheKeys = typeof config.maxCacheKeys === 'number' ? config.maxCacheKeys : 100;
        this.cacheTtl = typeof config.cacheTtl === 'number' ? config.cacheTtl : 100;

        this.retryOnFail = !!config.retryOnFailure;
        this.retryFailureLogger = () => {};

        this.retryMinCode = 400;
        this.retryMaxCode = 600;
        this.retryCount = 5;
        this.retryBackOff = 100;

        if (this.retryOnFail) {
            this.retryFailureLogger = config.retryOnFailure.fail || this.retryFailureLogger;
            this.retryMinCode = config.retryOnFailure.min || this.retryMinCode;
            this.retryMaxCode = config.retryOnFailure.max || this.retryMaxCode;
            this.retryCount = config.retryOnFailure.retries || this.retryCount;
            this.retryBackOff = config.retryOnFailure.backOff || this.retryBackOff;
        }

        this.enablePipe = config.enablePipe;
        this.respondWithObject = config.respondWithObject === true;

        this.cacheByReference = config.cacheByReference;

        this.url = URL.parse(config.baseUrl);

        this.log = typeof config.customLogger === 'function' ? config.customLogger : defaultLogger;
        this.protocol = (config.protocol ? config.protocol : this.url.protocol) || 'http:';
        this.baseUrl = this.url.hostname;
        this.baseEndpoint = this.url.path;
        this.port = config.port || this.url.port || (this.protocol.indexOf('https') > -1 ? '443' : '80');

        this.keepAlive = (typeof config.keepAlive === 'boolean') ? config.keepAlive : true;

        let tmpAgent = (this.protocol === 'http:') ? new http.Agent({keepAlive: this.keepAlive}) : new https.Agent({keepAlive: this.keepAlive});

        if(typeof config.agent !== 'undefined' && typeof config.agent !== 'boolean') {
            this.agent = config.agent;
        }
        else if(typeof config.agent === 'boolean' && config.agent) {
            this.agent = tmpAgent;
        }
        else {
            this.agent = false;
        }

        this.parserFunction = config.parserFunction || JSON.parse;

        this.debug = typeof config.debug === 'boolean' ? config.debug : false;

        this.timeout = config.timeout || 60000;

        this.basicAuthToken = config.basicAuthToken;
        this.basicAuthSecret = config.basicAuthSecret;
        this.authorization = config.authorization;
        this.gzip = typeof config.gzip !== 'boolean' ? true : config.gzip;
        this.failWhenBadCode = typeof config.failWhenBadCode !== 'boolean' ? true : config.failWhenBadCode;

        this.auditor =  (a, b, c) => {
            process.nextTick(config.auditor === 'function' ? config.auditor : () => {}, a, b, c)
        };

        this.cacheIgnoreFields = Array.isArray(config.cacheIgnoreFields) ? config.cacheIgnoreFields : [];

        this.respondWithProperty = typeof config.respondWithProperty !== 'boolean' ? (config.respondWithProperty || 'data') : false;//set to false if you want everything!

        this.headers = Object.assign({}, this.clone({
            'User-Agent': 'request',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': this.gzip ? 'gzip, deflate' : undefined,
            Authorization: this.basicAuthToken ? ('Basic ' + (new Buffer(this.basicAuthToken + ':' + (this.basicAuthSecret ? this.basicAuthSecret : ''), 'utf8')).toString('base64')) : this.authorization?this.authorization:undefined
        }), config.headers);
    }

    clearCache () {
        this.cache = {};
        this.cacheKeys = [];
    }

    extendStream(resultant, Transformer) {
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
    }

    clone(data) {
        return data ? JSON.parse(JSON.stringify(data)) : data;
    }

    addCacheElement(key, value) {
        if (this.cacheTtl) {
            if (this.cacheKeys.length >= this.maxCacheKeys) {
                delete this.cache[this.cacheKeys.shift()];
            }
            this.cacheKeys.push(key);

            this.cache[key] = {
                lastInvokeTimeout: setTimeout( () => {
                    this.cacheKeys = this.cacheKeys.filter(testKey => testKey !== key);
                    delete this.cache[key];
                }, this.cacheTtl),
                value: this.clone(value)
            };
        }
        return value;
    }

    getCacheElement(key) {
        let value = this.cache[key] ? this.cache[key].value : null;
        if (!this.cacheByReference) {
            value = this.clone(value);
        }
        return value;
    }


    //more perminant for this instance
    setHeader(key, value) {
        this.headers[key] = value;
    }

    getCookiesFromHeader(headers) {

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

    handleCallbackOrPromise(verb, endpoint, options, callback, failure) {


        if (typeof endpoint === 'undefined') {
            endpoint = '';
        }

        if (typeof options === 'undefined') {
            options = {};
        }


        if(Array.isArray(endpoint)){
            return this.handleBulkBatch(verb, endpoint, options, callback, failure);
        }

        let res = this.makeRequest(verb, endpoint, options);

        return this.promiseOrCallbacks(res, options, callback, failure);
    }

    promiseOrCallbacks (promise, options, callback, failure) {

        if (typeof callback === 'function' && typeof failure === 'function') {
            return promise.then(callback, failure);
        }
        else if (typeof options === 'function' && typeof callback === 'function') {
            return promise.then(options, callback);
        }
        else if (typeof callback === 'function') {
            return promise.then((data) => {
                callback(null, data)
            }, (err) => {
                callback(err)
            });
        }
        else {
            return promise;
        }
    }

    /**
     * handleBulkBatch
     *  - bulk - meaning sending a bunch of requests possibly of different Urls but essentially at a batchSize of 1
     *  - batch - meaning an array of entities being sent to the same-ish url but sent via batching (splitting into batches of batchSize)
     * @param verb - [GET, POST, PUT, PATCH, DELETE, ETC]
     * @param endpoint - {Array} or strings or Objects with url property
     * @param options - opts all requests share
     * @param callback - callback
     * @param failure - failure callback if you want
     * @returns {*} - promise if no callbacks
     */
    handleBulkBatch(verb, endpoint, options, callback, failure) {
        if(options.batch){
            let batchSize = options.batchSize || 254;
            let batches = Math.ceil(endpoint.length/batchSize);
            let batchings = [];
            for(let i = 0; i < batchSize*batches; i+=batchSize) {
                let bodys = endpoint.slice(i, batchSize);
                batchings.push({
                    url : bodys[0].url,
                    body : bodys.map(e => e.body)
                });
                // batchResults.push(Promise.all(this.handleBulkBatch(verb, url, Object.assign({}, options, {batch : false, body : , callback, failure)));
            }
            let res = this.handleBulkBatch(verb, batchings, Object.assign({}, options, {batch : false}));

            return this.promiseOrCallbacks(res, options, callback, failure);
        }

        let timing = options.bulkDelay || 50;

        let doBackOffRequest = (endp, i) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    let url = '';
                    let opts = {};
                    if (typeof endp === 'object' && typeof endp.url === 'string') {
                        url = endp.url;
                        opts = Object.assign({}, endp, options);
                    }
                    else if (typeof endp === 'string') {
                        url = endp;
                        opts = Object.assign({}, options);
                    }
                    return this.handleCallbackOrPromise(verb, url, opts).then(resolve, reject);
                }, timing * i);
            }).then(data => data, err => Promise.resolve({
                error: err,
                request: endp
            }));
        };

        let resp = Promise.all(endpoint.map( (endp, i) => {
            return doBackOffRequest(endp, i);
        }));

        return this.promiseOrCallbacks(resp, options, callback, failure);

    }

    calcRequestOpts(verb, endpoint, opts, postData) {
        let requestOptions = {
            method: verb,
            protocol: opts.protocol || this.protocol,
            port: opts.port || this.port,
            host: opts.baseUrl || this.baseUrl,
            path: path.join(this.baseEndpoint || '', endpoint).replace('/?', '?'),
            timeout: opts.timeout || this.timeout,
            agent: (typeof opts.agent === 'boolean') ? opts.agent : this.agent
        };


        if (typeof opts.headers === 'object') {
            requestOptions.headers = Object.assign({}, this.headers, opts.headers);
        }
        else {
            requestOptions.headers = this.headers;
        }

        if (postData) {
            requestOptions.headers = Object.assign({}, requestOptions.headers,
                {
                    'Content-Length': Buffer.byteLength(postData)
                });
        }
        if (this.debug) {
            console.log('request opts', requestOptions);
        }
        return requestOptions;
    }

    retry(verb, endpoint, opts, retrysSoFar) {
        return new Promise((resolve, reject) => {
            return setTimeout(() => {
                this.makeRequest(verb, endpoint, opts).then(resolve, reject);
            }, this.retryBackOff * (retrysSoFar));
        });
    }


    failedDueToBadCode(statusCode) {
        return (this.failWhenBadCode && statusCode >= 400) && (this.retryMaxCode >= statusCode) && (this.retryMinCode <= statusCode);
    }

    makeRequest(verb, endpoint, opts) {

        if (typeof opts !== 'object') {
            opts = {};
        }

        if (this.retryOnFail && typeof opts.retriesAttempted !== 'number') {
            opts.retriesAttempted = 0;
        }

        if (this.debug) {
            this.log(verb, endpoint, new Date().getTime());
        }

        const postData = typeof opts.body !== 'undefined' ? JSON.stringify(opts.body) : null;
        let requestOptions = this.calcRequestOpts(verb, endpoint, opts, postData);

        let tmpCacheKey = Object.assign({}, requestOptions, {agent: 'cache'});

        this.cacheIgnoreFields.forEach(complexKey => {
            deepSet(tmpCacheKey, complexKey, undefined);
        });

        let cacheKey = JSON.stringify(tmpCacheKey);

        if (this.cacheTtl) {
            let cacheValue = this.getCacheElement(cacheKey);
            if (cacheValue) {
                return new Promise((resolve) => {
                    if (this.debug) {
                        this.log(verb, endpoint, new Date().getTime());
                    }
                    resolve(cacheValue);
                });
            }
        }

        let responseData = [];

        const start = Date.now();
        let timeStartResponse = null;
        let timeEndResponse = null;

        const Transformer = new Transform({
            highWaterMark: (opts && typeof opts.highWaterMark === 'number') ? opts.highWaterMark : 16384 * 16,
            transform(chunk, enc, callback) {
                if(!timeStartResponse) {
                    timeStartResponse = Date.now();
                }
                if (this.enablePipe) {
                    callback(null, chunk);
                }
                else {
                    responseData.push(chunk.toString('utf8'));
                    callback(null, null);
                }
            }
        });


        let resultant = new Promise((resolve, reject) => {
            const req = (requestOptions.protocol.indexOf('https') === -1 ? http : https).request(requestOptions, (response) => {
                const startOfRequestTime = Date.now();

                if ((typeof response.headers['content-encoding'] === 'string') &&
                    ['gzip', 'deflate'].indexOf(response.headers['content-encoding'].toLowerCase()) !== -1) {
                    response.pipe(zlib.createUnzip()).pipe(Transformer);
                }
                else {
                    response.pipe(Transformer);
                }

                Transformer.on('finish', () => {
                    timeEndResponse = Date.now();

                    let stringedResponse = responseData.join('');
                    let data = 'No Content';
                    let responseCookies = this.getCookiesFromHeader(response.headers);


                    let startTimeDiff = startOfRequestTime - start;
                    let responseTimeDiff = (timeStartResponse-startOfRequestTime);
                    let extendedResponse = {
                        statusCode : response.statusCode, // keep it compliant with other libraries
                        code: response.statusCode,
                        request: {
                            agent: !!requestOptions.agent,
                            cookies : this.getCookiesFromHeader(requestOptions.headers),
                            baseUrl : this.baseUrl,
                            headers : requestOptions.headers,
                            method: requestOptions.method,
                            protocol: requestOptions.protocol,
                            port: requestOptions.port,
                            host: requestOptions.baseUrl,
                            path: requestOptions.path,
                            timeout: requestOptions.timeout,
                            postData : postData
                        },
                        response : {
                            statusCode : response.statusCode,
                            headers : response.headers,
                            cookies : responseCookies,
                            size : stringedResponse.length
                        },
                        timing : {
                            start : startTimeDiff,
                            response : responseTimeDiff,
                            end :(timeEndResponse-timeStartResponse)
                        },
                        headers: response.headers,
                        cookies: responseCookies,
                        retries: opts.retriesAttempted
                    };

                    let minData = stringedResponse?this.parserFunction(stringedResponse):data;
                    let shouldReadIn = (!this.failedDueToBadCode(response.statusCode) && this.respondWithProperty);
                    let dOrP = shouldReadIn ? deepValue(minData, this.respondWithProperty): minData;
                    extendedResponse.body = dOrP;
                    data = this.respondWithObject ? extendedResponse : dOrP;

                    let localAuditor = (typeof opts.auditor === 'function'? opts.auditor:this.auditor);
                    localAuditor(extendedResponse, data, response.headers);//allow you to override the auditor function on request

                    if (this.failedDueToBadCode(response.statusCode)) {
                        if (this.retryOnFail && (opts.retriesAttempted < this.retryCount)) {
                            return this.retry(verb, endpoint, opts, opts.retriesAttempted++).then(resolve, reject);
                        }

                        process.nextTick(this.retryFailureLogger, data, response.headers);

                        return reject(data || new Error('unknown error'));
                    }

                    resolve(this.addCacheElement(cacheKey, data));
                });

                Transformer.on('error', (err) => {
                    this.log('transform error', err);
                    reject(err || new Error('unknown transform stream error'));
                });

            });

            req.on('error', function (err) {
                reject(err || new Error('error'));
            });

            req.on('timeout', function (err) {
                reject(err || new Error('timeout'));
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });

        if (typeof this.enablePipe === 'boolean' && this.enablePipe) {
            this.extendStream(resultant, Transformer);
        }

        return resultant;
    }

    get(endpoint, options, callback, failure) {
        return this.handleCallbackOrPromise('GET', endpoint, options, callback, failure);
    }

    post(endpoint, options, callback, failure) {
        return this.handleCallbackOrPromise('POST', endpoint, options, callback, failure);
    }

    delete(endpoint, options, callback, failure) {
        return this.handleCallbackOrPromise('DELETE', endpoint, options, callback, failure);
    }

    put(endpoint, options, callback, failure) {
        return this.handleCallbackOrPromise('PUT', endpoint, options, callback, failure);
    }

    patch(endpoint, options, callback, failure) {
        return this.handleCallbackOrPromise('PATCH', endpoint, options, callback, failure);
    }

    /**
     *
     * @param config
     *  - url - extention to parents baseUrl
     *  - headers - extension to parents headers
     *  - auditor - override of parents auditor
     *  - requestExtender - function which extends all requests
     * @returns {SubClient}
     */
    child (config) {
        if(!config){
            config = {};
        }
        return new SubClient({
            url : config.url,
            headers : config.headers,
            auditor : config.auditor,
            requestExtender : config.requestExtender,
            parentClient : this
        });
    }

};

module.exports = HyperRequest;