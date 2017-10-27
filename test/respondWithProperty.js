/**
 * Created by daniel.irwin on 5/8/17.
 */

describe('SimpleRestClient Tests', function() {

    let SimpleRestClient = require('../hrequest')({
        baseUrl : 'http://api.fixer.io/',
        respondWithProperty : 'rates'
    });

    let assert = require('chai').assert;

    it('get currency usd jan 2nd and expect value deep read rates property', function(done){
        this.timeout(2500);
        SimpleRestClient.get('2017-01-02?symbols=USD', {}).then( (data) => {
            console.log('got', data);
            assert.deepEqual({
                USD : 1.0465
            }, data);
            done();
        }, (err) => {
            done(err || 'error')
        })
    });

});