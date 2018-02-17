#Versions

    0.1.15 
        - Https defaults to port 443 if no port specified
    0.1.16 
        - Fix respondWithProperty
    0.1.17 
        - added opts.cacheByReference, defaults to false, if true responses returned by cache are references and not copies
    
    1.0.0 
        - reversed pipe parameter from disablePipe => enablePipe, and made it smarter
 
    2.0.0 
        - re-engineered (keeping mostly backward compatible) to be ES6 classful
    2.0.1 
        - bug fix, bulk/batch, clearCache fnc
    2.0.2 
        - make bulk not fail on failure instead return error object
    2.0.3 
        - respondWithObject gives more data in a better format
    2.0.4 
        - add baseUrl to respondWithObject response
    2.0.5 
        - add postData to respondWithObject response
    
    2.1.0 
        - SubClient, via child() method gives you a client that has overrides but shares the same cache / etc