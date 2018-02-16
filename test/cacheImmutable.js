describe('SimpleRestClient Tests immutable cache', function() {

    let HyperRequest = require('../hrequest');
    var SimpleRestClient = new HyperRequest({
        baseUrl: 'http://channels.test.net/api/v1/',
        cacheTtl : 1000000
    });

    var assert = require('chai').assert;

    it('get channels - cached', function (done) {

        SimpleRestClient.get('channels', {})
            .then(function (data) {
                data.fred = '7';
                SimpleRestClient.get('channels', {}).then( (data2) => {
                    assert.isUndefined(data2.fred);
                    done();
                }).catch((err) => {
                    done(err);
                });

            }, function (err) {
                done(err);
            });

    });

    it('get channels - cached2', function (done) {

        SimpleRestClient.get('channels', {})
            .then(function (data) {
                data.fred = '7';
                return data;
            }, function (err) {
                done(err);
            }).then(data2 => {
                SimpleRestClient.get('channels', {}).then( (res) => {
                    assert.isUndefined(res.fred);
                    // console.log('res', res);
                    done();
                }).catch((err) => {
                    done(err);
                });
            });

    });


});
