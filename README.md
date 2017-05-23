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
        parserFunction : function(data){ return JSON.parse(data) } // optional ( defaults to JSON.parse
        timeout : 4000,
        cacheTtl : 500
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