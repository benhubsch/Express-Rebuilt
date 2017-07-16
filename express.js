"use strict";
const http = require('http')
const querystring = require('querystring')
const Handlebars = require('handlebars')
const fs = require('fs');


module.exports = function () {
    var storedRoutes = {'functions': []}
    var nextVal = '3HlufdU3tfX1inL5uUvUPvjg2vDR9W0tL5'

    function prefixContained(seenArr, routePrefix) {
        for (var i=0; i < seenArr.length; i++) {
            if (routePrefix.indexOf(seenArr[i].split(' ')[1]) >= 0 && seenArr[i].split(' ')[0] === 'USE') {
                return true
            }
        }
        return false
    }

    function isPrefixMatch(prefix1, prefix2) {
        return prefix1.indexOf(prefix2) >= 0
    }

    function isParamsMatch(entered, route) {
        var enteredArr = entered.split('/')
        var routeArr = route.split('/')
        if (enteredArr.length !== routeArr.length) {
            return false
        } else {
            for (var i=0; i < enteredArr.length; i++) {
                if (routeArr[i].substring(0,1) !== ':' && routeArr[i] !== enteredArr[i]) {
                    return false
                }
            }
        }
        return true
    }

    function getParamsObj(entered, route) {
        var obj = {}
        var enteredArr = entered.split('/')
        var routeArr = route.split('/')
        for (var i=0; i < enteredArr.length; i++) {
            if (routeArr[i].substring(0,1) === ':') {
                obj[routeArr[i].substring(1, routeArr[i].length)] = enteredArr[i]
            }
        }
        return obj
    }


    return {
        use: function(routePrefix, callback) {
            if (typeof routePrefix === 'function') {
                callback = routePrefix
                routePrefix = '/'
            }
            if (! prefixContained(storedRoutes['functions'], routePrefix)) {
                storedRoutes['functions'].push('USE ' + routePrefix)
                if (! storedRoutes[routePrefix]){
                    storedRoutes[routePrefix] = {'USE': callback}
                } else if (! storedRoutes[routePrefix]['USE']){
                    storedRoutes[routePrefix]['USE'] = callback
                }
            }
        },
        get: function(route, callback) {
            if (! storedRoutes[route]) {
                storedRoutes[route] = {'GET': callback}
                storedRoutes['functions'].push('GET ' + route)
            } else if (! storedRoutes[route]['GET']) {
                storedRoutes[route]['GET'] = callback
                storedRoutes['functions'].push('GET ' + route)
            }
        },
        post: function(route, callback) {
            if (! storedRoutes[route]) {
                storedRoutes[route] = {'POST': callback}
                storedRoutes['functions'].push('POST ' + route)
            } else if (! storedRoutes[route]['POST']) {
                storedRoutes[route]['POST'] = callback
                storedRoutes['functions'].push('POST ' + route)
            }
        },
        listen: function(port) {
            const server = http.createServer(function(req, res){
                res.send = function(string) {
                    res.writeHead(200, {'Content-Type': 'text/plain'})
                    res.end(string)
                }

                res.json = function(obj) {
                    res.writeHead(200, {'Content-Type': 'application/json'})
                    res.end(JSON.stringify(obj))
                }

                res.render = function(name, option) {
                    var filepath = './views/' + name
                    var hbs = fs.readFileSync(filepath).toString('utf8')
                    var template = Handlebars.compile(hbs);

                    res.writeHead(200, {'Content-Type': 'text/html'})
                    res.end(template(option))
                }

                function next() {
                    return '3HlufdU3tfX1inL5uUvUPvjg2vDR9W0tL5'
                }

                var route = req.url.split('?')[0]
                if (req.url.indexOf(':') >= 0) {
                    req.params = getParams(req.url)
                } else {
                    req.query = querystring.parse(req.url.split('?')[1])
                }

                var target = req.method.toUpperCase() + ' ' + route
                var method = target.split(' ')[0]
                for (var i=0; i < storedRoutes['functions'].length; i++) {
                    var storedMethod = storedRoutes['functions'][i].split(' ')[0] // these are mostly useful for
                    var storedRoute = storedRoutes['functions'][i].split(' ')[1]  // middleware
                    if (storedRoutes['functions'][i] === target) {
                        var goNext = handleFinalMatch(storedRoute)
                        if (goNext === nextVal) continue;
                    } else if (storedMethod === 'USE' && (storedRoute === '/' || isPrefixMatch(route, storedRoute))) { //this is MIDDLEWARE
                        // console.log('1', storedRoutes[storedRoute]['USE']);
                        // console.log('2', next);
                        var middlewareReturned = storedRoutes[storedRoute]['USE'](req, res, next)
                        if (middlewareReturned === nextVal) continue;
                    } else { // check if it matches any params routes
                        if (storedRoute.indexOf(':') >= 0 && isParamsMatch(route, storedRoute)) {
                            req.params = getParamsObj(route, storedRoute)
                            var goNext = handleFinalMatch(storedRoute)
                            if (goNext === nextVal) continue;
                        }
                    }
                }

                function handleFinalMatch(storedRoute) {
                    var goNext;
                    console.log(method, storedRoute);
                    if (method === 'GET') {
                        console.log('here', next);
                        goNext = storedRoutes[storedRoute]['GET'](req, res, next)
                        console.log(goNext);
                    } else if (method === 'POST') {
                        var body = '';
                        req.on('readable', function() {
                            var chunk = req.read();
                            if (chunk) body += chunk;
                        });
                        req.on('end', function() {
                            req.body = querystring.parse(body);
                            goNext = storedRoutes[storedRoute]['POST'](req, res, next)
                        });
                    }
                    console.log(goNext);
                    return goNext
                }

            })
            server.listen(port)
        }
    };
};
