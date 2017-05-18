/**
 * Created by daniel.irwin on 5/8/17.
 */
describe('SimpleRestClient Tests', function(){

    var SimpleRestClient = require('../hrequest')({
        baseUrl : 'http://api.fixer.io/',
        customLogger : function(){},
        rawResponseCaller : function(a, b){

        },
        timeout : 4000,
        respondWithProperty: 'rates'
    });

    var assert = require('chai').assert;

    it('get channels', function(done){

        SimpleRestClient.get('/latest', {
        }, function(data){
            console.log('data', data);
            done();
        }, function(err){
            assert.fail(err);
        });
    });


    //http://stackoverflow.com/questions/9025095/how-can-i-test-uncaught-errors-in-mocha
    it('get channels on failure dont call failure', function(done) {

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

        var originalException = process.listeners('uncaughtException').pop();
        //Needed in node 0.10.5+
        process.removeListener('uncaughtException', originalException);
        process.once("uncaughtException", function (err) {
            if(err.message === 'error thrown inside success') {
                done();
            }
        });

    });


    it('promises', function(done) {

        SimpleRestClient.get('/latest', {}).then(function(data){
            console.log('data', data);
            done();
        }, function(err){
            assert.fail(err);
        });
    });


    it('streams', function(done) {

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