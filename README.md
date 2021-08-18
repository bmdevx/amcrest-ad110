# Amcrest AD110

![Libraries.io dependency status for GitHub repo](https://img.shields.io/david/bmdevx/amcrest-ad110?style=flat-square)  [![npm](https://img.shields.io/npm/dt/amcrest-ad110?style=flat-square)](https://www.npmjs.com/package/amcrest-ad110) [![npm](https://img.shields.io/npm/v/amcrest-ad110?style=flat-square)](https://www.npmjs.com/package/amcrest-ad110) ![GitHub](https://img.shields.io/github/license/bmdevx/amcrest-ad110?style=flat-square)

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
    resetTime: 900,       //(optional) Time in seconds which to reset the connection. Setting to 0 does not reset.
    debug: false          //'raw', 'debug', and 'error' messages are sent out on the main listen stream.
})

isAlive();                //returns promise(bool)

takeSnapshot();           //returns promise(buffer)

start();                  //start listening to events
stop();                   //stop listening to events


listen(listener);         //listen to all events (event object contains an 'action' and sometimes 'data' object or an 'index' value)
                          //When debugging is on, 'raw', 'debug', and 'error' are also output
unlisten();               //remove all listeners

//Specific events (Processed Events Only):
onMotion(listener);
onVideoMotion(listener);
onVideoBlindStart(listener);
onDoorbellButtonPress(listener);
onDoorbellAnswer(listener);
onDoorbellHangup(listener);
onCallNotAnswered(listener);

onRawData(listener);
onError(listener);
```

## Future Development

* Get/Set Custom Configuration
* Possibily:
  * Record Video
  * Talk and Listen to Audio
