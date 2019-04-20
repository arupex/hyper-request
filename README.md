# hyper-request
    Simpler Http/s than build in node

[![npm version](https://badge.fury.io/js/hyper-request.svg)](https://badge.fury.io/js/hyper-request)
[![dependencies](https://david-dm.org/arupex/hyper-request.svg)](http://github.com/arupex/hyper-request)
[![Donate](https://img.shields.io/badge/Donate-Arupex-green.svg)](https://pledgie.com/campaigns/31873)
![lifetimeDownloadCount](https://img.shields.io/npm/dt/hyper-request.svg?maxAge=259200000)


# Install
  
    npm install hyper-request --save


# Usage ( showing defaults, minus baseUrl )

    const HyperRequest = require('hyper-request')

    let SimpleRestClient = new HyperRequest({
        baseUrl : 'http://api.fixer.io/latest',
        customLogger : function(){},
        rawResponseCaller : function(a, b){

        },
        failWhenBadCode : true,//fails when >= a 400 code
        retryOnFailure:{
            fail : function(){},
            min : 300.
            max : 600,
            retries : 5,
            backOff : 10 //ms
        },
        gzip : true,
        respondWithObject : true, //returns headers and request as well
        respondWithProperty : 'data', //returns response property as top level, if set to false it returns full body
        parserFunction : function(data){ return JSON.parse(data) } // optional ( defaults to JSON.parse
        timeout : 4000,
        maxCacheKeys : 10,
        cacheTtl : 500,
        enablePipe : false,
        highWaterMark : 16000//set the high water mark on the transform stream
        cacheByReference : false // if true cache returns back the object returned in itself, does not return a copy, thus is mutable
        authorization : ''//raw authorization header if applicable
        cacheIgnoreFields : ['headers.request_id']
    });
    
    SimpleRestClient.get('/endpoint', {
        headers : {},
        body : {}
    });
    
## Dont be intimidated you may only need baseUrl if you just want a json client
     const SimpleRestClient = new HyperRequest({
          baseUrl : 'http://api.fixer.io/latest',
     });
    
     SimpleRestClient.get('/endpoint', {
          headers : {},
          body : {}
     });
    
#### For In depth usage, I recommend looking at unit tests and the actual code (its not that scary), feel free to contribute!
    
#Methods - all http methods support a url and options object (url, { body : {}, headers : {}, etc... }) so you can include body/headers/etc
####Http Methods
    get
    post
    delete
    put
    patch   
    
#### Util Methods
    clearCache()
    makeRequest(verb, endpoint, opts)
    getCookiesFromHeader(headersObj)
    getCacheElement(key)
    addCacheElement(key, value)
    clone(data) - deep clone (json.parse(json.stringify(data))
    deepRead(obj, accessorString)
    
# Callbacks

        SimpleRestClient.get('?symbols=USD,GBP', {}, succesCallbacks, failCallback);


# Promises

        SimpleRestClient.get('?symbols=USD,GBP', {}).then(function(){
            
        },
        function(){
        
        });
        
        
# Bulk

        SimpleRestClient.get(['?symbols=USD,GBP', '?symbols=GBP,USD'], {}).then(function(array){
            
        });
        
# Batch

        SimpleRestClient.post([{},{},{},{},{}], { batch : true, batchSize : 2 }).then(function(array){
            
        });

# Streams

        SimpleRestClient.get('?symbols=USD,GBP', {}).pipe(process.stdout;
        
        
# Retry with Back Off
    
        let client = HyperRequest({
            baseUrl : 'http://api.fixer.io/thisdoesnotexist',
            customLogger : function(verb, endpoint, time){},
            rawResponseCaller : function(a, b){},
            debug : true,
            timeout : 4000,
            respondWithProperty : 'rates',
            retryOnFailure : {
                fail : (info) => {// a 'global' callback when a failure occurs (good for logging or retry failures)
                    console.log('error ' , info);
                },
                min :  400, //min http response code
                max :  600, //max http response code
                retries   :  2, //number of retries
                backOff :  100//backoff in ms * by retry count
            }
        });
        
# SubClient

    let child = client.child({ url = '', headers = {}, audit}) 
    
    child.get('/thing')
    
    where audit is called on all requests and feeds back rawResponse
        
This will retry 1 time beyond the initial try with a 100 ms backoff, on any errors between (inclusive) of 400 and 600 http response codes
because this endpoint is a 404 it will retry twice, and fail hitting both the failure callback/reject/emit error, and will hit the global fail callback


# Retry With Digest(extension)

In this example we have a client which re-auths with its IAM system if it gets a 401-403 error

        var dataSystem = new Request({
            baseUrl : 'http://currency.svc.mylab.local',
            respondWithProperty : 'data',
            retryOnFailure : {
                min :  401,      //min http response code
                max :  403,      //max http response code
                retries   :  5,  //number of retries
                backOff :  100,  //backoff in ms * by retry count
                retryExtension : (failedResponse) => {
                    return iamSystem.post('sessions/login', { body : { username : 'user', password :'pass' } }).then((resp) => {
                        return {
                            persist : true,
                            extensions : [
                                {
                                    accessor :'headers.Authentication',
                                    value : resp.session
                                }
                            ]
                        };
                    });
                }
            }
        });
When a retry happens the retryExtension function <Promise> is called first
 any 'extension' object it returns gets executed on the request options before the next request is executed,
  if persist is true, it persists on later calls