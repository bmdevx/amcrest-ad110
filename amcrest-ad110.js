const events = require('events');
const got = require('got/dist/source');
const Auth = require('http-auth-client')

const ATTACH_PATH = '/cgi-bin/eventManager.cgi?action=attach&codes=[All]';
const SNAPSHOT_PATH = '/cgi-bin/snapshot.cgi';
const TIME_PATH = '/cgi-bin/global.cgi?action=getCurrentTime';

const DEFAULT_RETRY_DELAY = 60000;
const DEFAULT_USE_RAW_CODES = false;

class AmcrestAD110 {
    constructor(config) {
        if (config.ipAddr == undefined) throw 'No ipAddr defined';
        if (config.password == undefined) throw 'No password defined';

        this.ipAddr = config.ipAddr;
        this.password = config.password;

        this.rawCodes = config.rawCodes || DEFAULT_USE_RAW_CODES;
        this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;

        this.emitter = new events.EventEmitter();
        this.running = false;

        this.listener = null;
        this.auth = null;

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

            this.emitter.emit(event.code, event);
            this.emitter.emit('*', event);
        };

        this.attach = () => {
            this.isAlive()
                .then(alive => {
                    if (!alive) {
                        this.emitter.emit('error', 'AD110 Not Found');
                    } else {
                        this.listener = got(`http://${this.ipAddr}${ATTACH_PATH}`, {
                            headers: { 'Authorization': this.auth }
                        });

                        this.listener
                            .on('response', res => {
                                res.on('data', data => {
                                    var lines = Buffer.from(data).toString().split('\n');
                                    var midCode = false, al;

                                    lines.forEach(l => {
                                        if (l.startsWith('Code')) {
                                            if (l.includes('data={')) {
                                                al = l;
                                                midCode = true;
                                            } else {
                                                this.process(JSON.parse(`{"${l.replace(/=/g, '":"').replace(/;/g, '","').replace(/\r/g, '')}"}`));
                                            }
                                        } else if (midCode) {
                                            al += l;

                                            if (l.startsWith('}')) {
                                                try {
                                                    const idx = al.indexOf(';data=');
                                                    var event = al.substring(0, idx);
                                                    var data = al.substring(idx + 6);

                                                    var event = JSON.parse(`{"${event.replace(/=/g, '":"').replace(/;/g, '","').replace(/\r/g, '')}"}`)
                                                    event.data = JSON.parse(data);

                                                    this.process(event);
                                                } catch (err) {
                                                    this.emitter.emit('error', err);
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
                                            this.emitter.emit('error', 'Unauthorized Access');
                                        }
                                    }
                                    else {
                                        this.emitter.emit('error', JSON.stringify(err));
                                    }
                                } else {
                                    this.listener = null;
                                }

                                this.auth = null;
                            })
                            .finally(_ => {
                                if (this.running) {
                                    setTimeout(_ => {
                                        if (this.running) {
                                            this.attach();
                                        }
                                    }, this.retryDelay);
                                }
                            });
                    }
                });
        }
    }

    isAlive() {
        return new Promise((res, rej) => {
            got(`http://${this.ipAddr}${TIME_PATH}`)
                .catch(errRes => {
                    if (errRes.response.statusCode == 401) {
                        var challenges = Auth.parseHeaders(errRes.response.headers['www-authenticate']);
                        var auth = Auth.create(challenges);

                        auth.credentials('admin', this.password);

                        this.auth = auth.authorization("GET", ATTACH_PATH)

                        res(true);
                    } else {
                        res(false);
                    }
                });
        });
    }

    takeSnapshot() {
        return new Promise((res, rej) => {
            const getSnapshot = () => {
                got(`http://${this.ipAddr}${SNAPSHOT_PATH}`, {
                    headers: { 'Authorization': this.auth }
                }).buffer()
                    .then(res)
                    .catch(rej);
            };

            if (this.auth !== null) {
                getSnapshot();
            } else {
                this.isAlive()
                    .then(alive => {
                        getSnapshot();
                    })
                    .catch(rej);
            }
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

        if (this.listener) {
            this.listener.cancel();
        }
    }


    listen(listener) {
        this.emitter.addListener('*', listener);
    }

    unlisten() {
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


}


module.exports = AmcrestAD110;