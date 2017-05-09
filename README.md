# hyper-request
    Simpler Http than build in node


#Install
  
    npm install hyper-request --save


#Usage

    var SimpleRestClient = require('hyper-request')({
        baseUrl : 'http://api.fixer.io/latest',
        customLogger : function(){},
        rawResponseCaller : function(a, b){

        },
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
