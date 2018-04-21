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
    
    2.1.1
        - Update documentation
        
    2.1.3
        - Make SubClient work on older versions of NodeJS
    2.1.4
        - Make SubClient work on older versions of NodeJS
        
    2.1.5
        - Make constructor take
            - keepAlive (boolean) - default to false
            - agent (http(s) agent) - default to false
            
    2.1.6
        - Add headers to respondWithObject request

    3.0.0
        - auditor is first class citizen instead of rawResponseCaller which no longer exists
        - cache has cacheIgnoreFields option array so you can have it ignore fields on your request for cache keying
        - fixed a cache key issue
        - child has ability to have an extendRequest function which runs on every request before sent into parent
        
    3.0.1
        - fix auditor override on each request if passed in opts
    3.0.2
        - fixed missing typeof on parent auditor