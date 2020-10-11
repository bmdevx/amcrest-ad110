# Amcrest AD110

![David](https://img.shields.io/david/bmdevx/amcrest-ad110?style=flat-square)  [![npm](https://img.shields.io/npm/dt/amcrest-ad110?style=flat-square)](https://www.npmjs.com/package/amcrest-ad110) [![npm](https://img.shields.io/npm/v/amcrest-ad110?style=flat-square)](https://www.npmjs.com/package/amcrest-ad110) ![GitHub](https://img.shields.io/github/license/bmdevx/amcrest-ad110?style=flat-square)

## Features

* Listens to Amcrest AD110 events
* Checks if device exists
* Takes Snapshots

### Methods

``` js

constructor({
    ipAddr: 'Device IP Address',
    password: 'device password',
    retryDelay: 1000,     //(optional) How often to try and reconnect after loosing connection in millis
    rawCodes: false,      //(optional) Use rawCode data (properties are not uniform)
    resetTime: 900        //(optional) Time in seconds which to reset the connection. Setting to 0 does not reset.
})

isAlive();                //returns promise(bool)

takeSnapshot();           //returns promise(buffer)

start();                  //start listening to events
stop();                   //stop listening to events

//listen to all events (event object contains an 'action' and sometimes 'data' object or an 'index' value)
listen(listener);
unlisten();             //remove all listeners

//Specific events (Processed Events Only):
onMotion(listener);
onVideoMotion(listener);
onVideoBlindStart(listener);
onDoorbellButtonPress(listener);
onDoorbellAnswer(listener);
onDoorbellHangup(listener);
onCallNotAnswered(listener);

```

## Future Development

* Get/Set Custom Configuration
* Possibily:
  * Record Video
  * Talk and Listen to Audio
