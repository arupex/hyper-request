
describe('SimpleRestClient Tests', function() {

    const port = 1338;

    const Request = require('../hrequest');

    let SimpleRestClient = new Request({
        baseUrl : `http://api.fixer.io/`,
        respondWithProperty : 'rates.JPY',
        respondWithObject : false,
        parserFunction : (data) => {
            return JSON.parse(data);
        }
    });

    let Server = require('./bulkServer');
    let bulkUploadServer = new Server(port);

    let assert = require('chai').assert;

    it('bulk', function(done){
        this.timeout(2500);

        bulkUploadServer.listen( () => {

            SimpleRestClient.get([
                '/2018-01-01',
                '/2018-01-02',
                '/2018-01-03',
                '/2018-01-04',
                '/2018-01-05',
                '/2018-01-06',
                '/2018-01-07',
            ], {}).then( (data) => {
                console.log('got', JSON.stringify(data, null, 3) );
                assert.deepEqual([
                    135.01,
                    135.35,
                    134.97,
                    135.92,
                    136.45,
                    136.45,
                    136.45
                ], data);
                done();
            }, (err) => {
                done(err || 'error')
            });

        });

    });

    it('bulk2', function(done){
        this.timeout(2500);

        bulkUploadServer.listen( () => {

            SimpleRestClient.get([
                { url : '/2018-01-01' , headers : {}, body : {}},
                { url : '/2018-01-02' , headers : {}, body : {}},
                { url : '/2018-01-03' , headers : {}, body : {}},
                { url : '/2018-01-04' , headers : {}, body : {}},
                { url : '/2018-01-05' , headers : {}, body : {}},
                { url : '/2018-01-06' , headers : {}, body : {}},
                { url : '/2018-01-07' , headers : {}, body : {}},
            ], {}).then( (data) => {
                console.log('got', JSON.stringify(data, null, 3) );
                assert.deepEqual([
                    135.01,
                    135.35,
                    134.97,
                    135.92,
                    136.45,
                    136.45,
                    136.45
                ], data);
                done();
            }, (err) => {
                done(err || 'error')
            });

        });

    });

});