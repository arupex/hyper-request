# hyper-request
    Simpler Http/s than build in node


#Install
  
    npm install hyper-request --save


#Usage

    var SimpleRestClient = require('hyper-request')({
        baseUrl : 'http://api.fixer.io/latest',
        customLogger : function(){},
        rawResponseCaller : function(a, b){

        },
        retryOnFailure:{
            fail : function(){},
            min : 300.
            max : 600,
            retries : 5,
            backOff : 10 //ms
        },
        respondWithObject : true, //returns headers and request as well
        respondWithProperty : 'data', //returns response property as top level, if set to false it returns full body
        parserFunction : function(data){ return JSON.parse(data) } // optional ( defaults to JSON.parse
        timeout : 4000,
        maxCacheKeys : 10,
        cacheTtl : 500,
        highWaterMark : 16000//set the high water mark on the transform stream
    });
    
    SimpleRestClient.get('/endpoint', {
        headers : {},
        body : {}
    });
    
#Callbacks

        SimpleRestClient.get('?symbols=USD,GBP', {}, succesCallbacks, failCallback);


#Promises

        SimpleRestClient.get('?symbols=USD,GBP', {}).then(function(){
            
        },
        function(){
        
        });

#Streams

        SimpleRestClient.get('?symbols=USD,GBP', {}).pipe(process.stdout;
        
        
# Retry with Back Off
    
        var client = require('hyper-request')({
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
        
This will retry 1 time beyond the initial try with a 100 ms backoff, on any errors between (inclusive) of 400 and 600 http response codes
because this endpoint is a 404 it will retry twice, and fail hitting both the failure callback/reject/emit error, and will hit the global fail callback