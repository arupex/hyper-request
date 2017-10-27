describe('SimpleRestClient Tests', function() {

    var assert = require('chai').assert;

    it('get portquiz with port', function (done) {

        this.timeout(60000);

        var SimpleRestClient = require('../hrequest')({
            baseUrl: 'http://localhost:1337/',
            parserFunction : (data) => {
                console.log('data', data);
                return data;//cuz its html
            },
            respondWithProperty : false
        });

        SimpleRestClient.get('',{}).then(function (data) {
            console.log('data', data);

            let bool = data.includes('Preload some data for performance');

            console.log('bool', bool);
            assert.ok(bool);
            done();
        }, function (err) {
            done(err || new Error('unknown'));
        });

    });



    it('https should default to port 443 if no port specified', function(done){

        var SimpleRestClient = require('../hrequest')({
            baseUrl: 'https://api.fixer.io/',
        });


        SimpleRestClient.get('/latest', {}).then( (data) => {
            console.log('https data', data);
            done();
        }, (err) => {
            done(err || 'no error but failed')
        })

    });

});