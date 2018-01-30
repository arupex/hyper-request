/**
 * Created by daniel.irwin on 5/8/17.
 */
describe('SimpleRestClient Tests', function(){

    let Request = require('../hrequest');
    var SimpleRestClient = new Request({
        baseUrl : 'http://api.fixer.io/',
        customLogger : function(){},
        rawResponseCaller : function(a, b){

        },
        timeout : 4000,
        respondWithProperty: 'rates'
    });

    var assert = require('chai').assert;

    it('get currency latest', function(done){

        SimpleRestClient.get('/latest', {
        }, function(data){
            // console.log('data', data);
            done();
        }, function(err){
            assert.fail(err);
        });
    });


    it('get channelref through auth latest', function(done){
        var config = require('../private.json');

        var client = new Request({
            baseUrl : config.channelRef.baseUrl,
            customLogger : function(){},
            rawResponseCaller : function(a, b){

            },
            timeout : 4000,
            debug : true,
            respondWithProperty: false
        });

        client.get('/channels', {
            headers : {
                'X-Api-Key' : config.channelRef.apiKey
            }
        }, function(data){
            // console.log('data', data);
            done();
        }, function(err){
            assert.fail(err);
        });
    });



    //http://stackoverflow.com/questions/9025095/how-can-i-test-uncaught-errors-in-mocha
    it('get currency on failure dont call failure', function(done) {

        var error = new Error('error thrown inside success');

        function success(data) {
            console.log('', data);
            throw error;
        }

        function fail(err) {
            // console.log('called error callback');
            assert.fail(err);
        }

        SimpleRestClient.get('/latest', {}, success, fail);

        process.once("unhandledRejection", function (err) {
            if(err.message === 'error thrown inside success') {
                done();
            }
        });

    });


    it('currency with promises', function(done) {

        SimpleRestClient.get('/latest', {}).then(function(data){
            // console.log('data', data);
            done();
        }, function(err){
            assert.fail(err);
        });
    });


    it('currency streams', function(done) {
        var SimpleRestClient = new Request({
            baseUrl : 'http://api.fixer.io/',
            customLogger : function(){},
            rawResponseCaller : function(a, b){

            },
            enablePipe : true,
            timeout : 4000,
            respondWithProperty: 'rates'
        });

        let Writable = require('stream').Writable;
        const myBadAssStream = new Writable({
            // writableObjectMode: true,
            write(chunk, encoding, callback) {
                console.log('chunk', chunk.toString('utf8'));
                callback(null, chunk);
            }
        });

        let stream = SimpleRestClient.get('/latest', {});

        stream.pipe(myBadAssStream);

        myBadAssStream.on('finish', done)

    });


});