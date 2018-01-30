// content of index.js
const http = require('http');

class BulkServer {

    constructor(port) {
        this.port = port;
        this.server = http.createServer(this.requestHandler);
    }

    listen(cb){
        this.server.listen(this.port, (err) => {
            if (err) {
                return console.log('something bad happened', err);
            }
            console.log(`server is listening on ${this.port}`);
            if(typeof cb === 'function') {
                cb();
            }
        });
    }

    close(){
        this.server.close();
    }

    requestHandler(request, response) {
        console.log(request.url);
        response.end('hi');

        request.on('data', (chunk, enc, next) => {
            console.log('chunk', chunk.toString('utf8'));
            next();
        });
    }
}

module.exports = BulkServer;