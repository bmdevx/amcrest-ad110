const events = require('events');
const got = require('got');
const Auth = require('http-auth-client')

const ATTACH_PATH = '/cgi-bin/eventManager.cgi?action=attach&codes=[All]';
const SNAPSHOT_PATH = '/cgi-bin/snapshot.cgi';
const TIME_PATH = '/cgi-bin/global.cgi?action=getCurrentTime';

const DEFAULT_RETRY_DELAY = 10 * 1000;
const DEFAULT_USE_RAW_CODES = false;
const DEFAULT_RESET_TIME = 10 * 60 * 1000;

const DEBUG = false;

class AmcrestAD110 {
    constructor(config) {
        if (config.ipAddr == undefined) throw 'No ipAddr defined';
        if (config.password == undefined) throw 'No password defined';

        this.ipAddr = config.ipAddr;
        this.password = config.password;

        this.rawCodes = config.rawCodes || DEFAULT_USE_RAW_CODES;
        this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;
        this.resetTime = (config.resetTime || DEFAULT_RESET_TIME);

        this.debug = (config.debug || DEBUG);

        this.emitter = new events.EventEmitter();
        this.running = false;
        this.resetting = false;

        this.listener = null;

        this.emit = (code, data, format = false, debug = false) => {
            const formatData = (code, data) => {
                var obj = {};
                obj[code] = data;
                return obj;
            }

            this.emitter.emit(code, data);
            if (!debug || (this.debug && debug)) this.emitter.emit('*', format ? formatData(code, data) : data);
            if (code === 'error') console.error(data);
            if (code === 'debug' && this.debug) console.debug(data);
        };

        this.parse = (l) => JSON.parse(`{"${l.replace(/=/g, '":"').replace(/;/g, '","').replace(/\r/g, '')}"}`);

        this.process = (event) => {
            if (this.rawCodes === false) {
                switch (event.Code) {
                    case 'AlarmLocal': {
                        event.code = 'Motion';
                        break;
                    }
                    case '_DoTalkAction_': {
                        event = event.data;
                        event.code = event.Action;
                        delete event.Action;
                        break;
                    }
                    case 'CallNoAnswered': {
                        event.code = 'CallNotAnswered';
                        break;
                    }
                }

                if (event.code === undefined) {
                    event.code = event.Code;
                }

                if (event.Code !== undefined) {
                    delete event.Code;
                }
            }

            this.emit(event.code, event);
        };

        this.attach = () => {
            const url = `http://${this.ipAddr}${ATTACH_PATH}`;

            const reattach = () => {
                if (this.running) {
                    if (this.resetting) {
                        this.emit('debug', 'Resetting Connection', true);
                        this.resetting = false;
                        this.attach();
                    } else {
                        this.emit('error', `Connection Lost, Trying to connect again in ${this.retryDelay}ms`, true);
                        if (this.onretry) clearTimeout(this.onretry);
                        this.onretry = setTimeout(_ => {
                            if (this.running) {
                                this.attach();
                            }
                        }, this.retryDelay);
                    }
                } else {
                    this.emit('debug', 'Connection Ended', true);
                    this.resetting = false;
                }
            };

            this.getDigestOptions(url)
                .then(options => {
                    this.listener = got(url, options);

                    this.listener
                        .on('response', res => {
                            res.on('data', data => {
                                data = Buffer.from(data).toString();

                                this.emit('raw', data, true, true);

                                var lines = data.split('\n');
                                var midCode = false, al;

                                lines.forEach(l => {
                                    if (l.startsWith('Code')) {
                                        if (l.includes('data={')) {
                                            al = l;
                                            midCode = true;
                                        } else {
                                            try {
                                                this.process(this.parse(l));
                                            } catch (err) {
                                                this.emit('error', err.message, true);
                                            }
                                        }
                                    } else if (midCode) {
                                        al += l;

                                        if (l.startsWith('}')) {
                                            try {
                                                const idx = al.indexOf(';data=');
                                                var event = al.substring(0, idx);
                                                var edata = al.substring(idx + 6);

                                                event = this.parse(event);
                                                event.data = JSON.parse(edata);

                                                this.process(event);
                                            } catch (err) {
                                                this.emit('error', err.message, true);
                                            }
                                            this.midCode = false;
                                        }
                                    }
                                });
                            });
                        })
                        .catch(err => {
                            if (!err.isCanceled) {
                                if (err.response && err.response.statusCode) {
                                    if (err.response.statusCode == 401) {
                                        this.emit('error', 'Unauthorized Access', true);
                                    } else {
                                        this.emit('error', { 'errorType': 'invalid_response', 'response': err.response }, true);
                                    }
                                }
                                else this.emit('error', { 'errorType': 'unknown', 'err': err }, true);
                            } else {
                                this.listener = null;
                            }
                        })
                        .finally(_ => {
                            reattach()
                        });

                    if (this.resetTime > 0) {
                        if (this.onreset) clearTimeout(this.onreset);
                        this.onreset = setTimeout(() => {
                            this.resetting = true;
                            this.listener.cancel();
                        }, this.resetTime);
                    }
                })
                .catch(err => {
                    this.emit('error', { 'errorType': 'unknown', 'error': err }, true);
                    reattach();
                });
        }


        this.getDigestOptions = (path, options = {}) =>
            new Promise((res, rej) => {
                got(path, options)
                    .catch(errRes => {
                        if (errRes.response) {
                            if (errRes.response.statusCode == 401) {
                                var challenges = Auth.parseHeaders(errRes.response.headers['www-authenticate']);
                                var auth = Auth.create(challenges);
                                auth.credentials('admin', this.password);

                                if (options.headers) {
                                    options.headers['Authorization'] = auth.authorization("GET", path)
                                } else {
                                    options.headers = {
                                        'Authorization': auth.authorization("GET", path)
                                    }
                                }

                                res(options);
                            } else {
                                this.emit('error', { 'errorType': 'invalid_response', 'response': errRes.response }, true);
                                rej('Unexpected Error');
                            }
                        } else {
                            rej('Status Code Not 401');
                        }
                    });
            });
    }

    isAlive() {
        return new Promise((res, rej) => {
            this.getDigestOptions(`http://${this.ipAddr}${TIME_PATH}`)
                .then(options => {
                    res(true);
                })
                .catch(err => {
                    res(false);
                });
        });
    }

    takeSnapshot() {
        return new Promise((res, rej) => {
            const url = `http://${this.ipAddr}${SNAPSHOT_PATH}`;

            this.getDigestOptions(url)
                .then(options => {
                    got(url, options).buffer()
                        .then(res)
                        .catch(rej);
                })
                .catch(rej);
        });
    }


    start() {
        if (!this.running) {
            this.running = true;
            this.attach();
        }
    }

    stop() {
        this.running = false;

        if (this.onretry) clearTimeout(this.onretry);
        if (this.onreset) clearTimeout(this.onreset);
        if (this.listener) {
            this.listener.cancel();
        }
    }


    listen(listener) { // Listen for all Events
        this.emitter.addListener('*', listener);
    }

    unlisten() { //Unsubscribe from all
        this.emitter.removeAllListeners();
    }


    onMotion(listener) { //AlarmLocal
        this.emitter.addListener('Motion', listener);
    }

    onVideoMotion(listener) { //VideoMotion
        this.emitter.addListener('VideoMotion', listener);
    }

    onVideoBlindStart(listener) { //Videoblind
        this.emitter.addListener('VideoBlind', listener);
    }

    onDoorbellButtonPress(listener) { //_DoTalkAction_ : Invite
        this.emitter.addListener('Invite', listener);
    }

    onDoorbellAnswer(listener) { //?
        this.emitter.addListener('Answer', listener);
    }

    onDoorbellHangup(listener) { //_DoTalkAction_ : Hangup
        this.emitter.addListener('Hangup', listener);
    }

    onCallNotAnswered(listener) { //CallNoAnswered
        this.emitter.addListener('CallNotAnswered', listener);
    }


    onRawData(listener) { //Listen for Raw Data
        this.emitter.addListener('raw', listener);
    }

    onError(listener) { // Listen for Errors
        this.emitter.addListener('error', listener);
    }
}


module.exports = AmcrestAD110;
