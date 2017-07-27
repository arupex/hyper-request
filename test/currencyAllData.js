/**
 * Created by daniel.irwin on 5/8/17.
 */

describe('SimpleRestClient Tests', function() {


    var SimpleRestClient = require('../hrequest')({
        // protocol : 'http://',
        baseUrl : 'http://api.fixer.io/latest',
        basicAuthToken : '',
        customLogger : function(verb, endpoint, time){
            console.log(verb, endpoint, time);
        },
        rawResponseCaller : function(a, b){

        },
        debug : true,
        timeout : 4000,
        respondWithProperty : 'rates',
        respondWithObject : true
    });

    var assert = require('chai').assert;

    it('get currency', function(done){
        this.timeout(15000);
        SimpleRestClient.get('?symbols=USD,GBP', {
        }, function(data1){

            SimpleRestClient.get('?symbols=USD,GBP', {
            }, function(data2){
                console.log('data2', data2);
                done();
            }, function(err){
                done(err);
                assert.fail(err);
            });

        }, function(err){
            done(err);
            assert.fail(err);
        });
    });

});