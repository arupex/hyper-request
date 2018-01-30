/**
 * Created by daniel.irwin on 6/6/17.
 */

describe('retry', () => {

    const Request = require('../hrequest');

    var SimpleRestClient = new Request({
        // protocol : 'http://',
        baseUrl : 'http://api.fixer.io/thisdoesnotexist',
        basicAuthToken : '',
        customLogger : function(verb, endpoint, time){
            // console.log(verb, endpoint, time);
        },
        rawResponseCaller : function(a, b){

        },
        debug : true,
        timeout : 4000,
        respondWithProperty : 'rates',
        respondWithObject : true,
        retryOnFailure : {
            fail : (info) => {// a 'global' callback when a failure occurs (good for logging or retry failures)
                // console.log('error ' , info);
            },
            min :  400, //min http response code
            max :  600, //max http response code
            retries   :  2, //number of retries
            backOff :  100//backoff in ms * by retry count
        }
    });

    let assert = require('assert');


    it('should fail with 404', function(done) {

        this.timeout(5000);

        SimpleRestClient.get('test',{}, () => {
            done('failed')
        }, (err) => {
            assert.equal(JSON.stringify({ error : 'Not found' }),JSON.stringify( err.body));
            assert.equal(404, err.code);
            done();
        })
    });

});