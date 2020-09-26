# Amcrest AD110

![David](https://img.shields.io/david/bmdevx/amcrest-ad110?style=flat-square)  ![npm](https://img.shields.io/npm/dt/amcrest-ad110?style=flat-square) ![npm](https://img.shields.io/npm/v/amcrest-ad110?style=flat-square) ![GitHub](https://img.shields.io/github/license/bmdevx/amcrest-ad110?style=flat-square)

## Features

* Listens to Amcrest AD110 events
* Checks if device exists

### Methods

``` js

constructor({
    ipAddr: 'Device IP Address',
    password: 'device password',
    retryDelay: 60000    //optional
})

isAlive();               //returns promise(bool)

start();
stop();

//listen to all events (event object contains an 'action' and sometimes 'data' object or an 'index' value)
listen(listener);
unlisten();             //remove all listeners

//Specific events:
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
  * Take Snapshots
  * Record Video
  * Talk and Listen to Audio
