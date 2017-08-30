describe('SimpleRestClient Tests', function() {

    var SimpleRestClient = require('../hrequest')({
        baseUrl: 'http://localhost:8888/',
    });

    var assert = require('chai').assert;

    it('get channels', function (done) {

        SimpleRestClient.get('/api/v1/savings?space_id=7&start_date=2017-08-10&end_date=2017-08-10', {})
        .then(function (data) {
            done();
        }, function (err) {
            assert.fail(err);
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