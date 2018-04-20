/**
 * Created by daniel.irwin on 5/8/17.
 */

describe('Child Client Tests', function() {

    const Request = require('../hrequest');

    var SimpleRestClient = new Request({
        // protocol : 'http://',
        baseUrl : 'http://localhost:1337/api/v1/',
        basicAuthToken : '',
        customLogger : function(verb, endpoint, time){
            console.log(verb, endpoint, time);
        },
        rawResponseCaller : function(a, b){

        },
        debug : false,
        timeout : 4000,
        respondWithProperty : false,
        respondWithObject : true
    });

    let child = SimpleRestClient.child({
        requestExtender : (req) => {
            req.headers.fred = 'bob';
            return req;
        }
    });

    it('get currency nested call', function(done){
        this.timeout(1500);
        child.get('ping', {
        }, function(data){
            if(data.request.headers.fred === 'bob') {
                done();
            }
        });
    });

});