
let deep = require('deep-value');
const iamData = require('../private.json').iam;

describe('auth on retry', () => {


    it('should fail with 404 persist', function(done) {
        this.timeout(10000);

        let failed = 0;

        const Request = require('../hrequest');

        var iamSystem = new Request({
            baseUrl : iamData.baseUrl
        });

        var dataSystem = new Request({
            // protocol : 'http://',
            baseUrl : iamData.baseUrl,
            debug : false,
            respondWithProperty : 'data',
            retryOnFailure : {
                min :  400, //min http response code
                max :  403, //max http response code
                retries   :  5, //number of retries
                backOff :  100,//backoff in ms * by retry count
                retryExtension : (failedResponse) => {
                    failed++;

                    // console.log('failed', failedResponse.request.path, failedResponse.body);
                    return iamSystem.post('sessions/login', { body : iamData.body }).then((resp) => {
                        return {
                            persist : true,
                            extensions : [
                                {
                                    accessor : iamData.authHeaderName,
                                    value : deep(resp, iamData.pullFrom)
                                }
                            ]
                        };
                    });
                }
            }
        });

        dataSystem.get('users/details',{}, (data) => {

            console.log('data', data.details.profile.names.en_US.full_name);
            dataSystem.get('users/details',{}, (data) => {
                if(failed === 1) {
                    done();
                }
                else {
                    done('failed ' + failed);
                }
            }, (err) => {
                done('failed')
            })

        }, (err) => {
            done('failed')
        })
    });



    it('should fail with 404 dont persist', function(done) {
        this.timeout(10000);

        let failed = 0;

        const Request = require('../hrequest');

        var iamSystem = new Request({
            baseUrl : iamData.baseUrl
        });

        var dataSystem = new Request({
            // protocol : 'http://',
            baseUrl : iamData.baseUrl,
            debug : false,
            respondWithProperty : 'data',
            retryOnFailure : {
                min :  400, //min http response code
                max :  403, //max http response code
                retries   :  5, //number of retries
                backOff :  100,//backoff in ms * by retry count
                retryExtension : (failedResponse) => {
                    failed++;

                    // console.log('failed', failedResponse.request.path, failedResponse.body);
                    return iamSystem.post('sessions/login', { body : iamData.body }).then((resp) => {
                        return {
                            persist : false,
                            extensions : [
                                {
                                    accessor : iamData.authHeaderName,
                                    value : deep(resp, iamData.pullFrom)
                                }
                            ]
                        };
                    });
                }
            }
        });

        dataSystem.get('users/details',{}, (data) => {

            console.log('data', data.details.profile.names.en_US.full_name);
            dataSystem.get('users/details',{}, (data) => {
                if(failed === 2) {
                    done();
                }
                else {
                    done('failed ' + failed);
                }
            }, (err) => {
                done('failed')
            })

        }, (err) => {
            done('failed')
        })
    });


});