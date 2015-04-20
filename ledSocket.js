/**
 * FILE:	ledSocket.js
 *
 * USAGE:	node ledSocket.js
 *
 * DESCRIPTION:	Access and control RPi GPIO via the web.
 *		Code copied from BeagleBone & adapted as necessary.
 *
 * AUTHOR: 	Mark Wrigley
 * VERSION: 	0.01
 * CREATED: 	15.04.2015
 * REVISION: 	dd.mm.2015
 *
 * CONFIG:	tri-colour LED connected to GPIO 17, 27, 22
 * 		MCP3008 (ADC) connected to GPIO 18, 23 24, 25
 *
 */

var app = require('http').createServer(function handler (req, res) {
  fs.readFile('/home/pi/nodeApps/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200); 
      res.end(data); 
    }
  );
}).listen(2002);
var io = require('socket.io')(app);
var fs = require('fs');
var Gpio = require('onoff').Gpio;

var ledPin={};
ledPin[0] = new Gpio(17, 'out', 'both');
ledPin[1] = new Gpio(27, 'out', 'both');
ledPin[2] = new Gpio(22, 'out', 'both');

clock   = new Gpio(18, 'out');
adc_out = new Gpio(23, 'in');
adc_in  = new Gpio(24, 'out');
cs      = new Gpio(25, 'out');

var ledState={};
for (i=0; i<=2; i++) {
  ledState[i]=0;
  ledPin[i].writeSync(ledState[i]);
  ledPin[i].watch(emitLedStatus);
} 

// the callback function for LEDs that change state
function emitLedStatus(err, state) {
  for (i=0; i<=2; i++) {
      io.sockets.emit('ledstatus',i,ledState[i]);
  }
}

// get ADC value
readAdc = function(adc_pin, clockpin, adc_in, adc_out, cspin) {
  cspin.writeSync(1);
  clockpin.writeSync(0);
  cspin.writeSync(0);
  command_out = adc_pin;
  command_out |= 0x18;
  command_out <<= 3;
  for (i = 0; i <= 4; i++) { 
    if ((command_out & 0x80) > 0) {
      adc_in.writeSync(1);
    } else {
      adc_in.writeSync(0);
    }
    command_out <<= 1;
    clockpin.writeSync(1);
    clockpin.writeSync(0);
  }

  clockpin.writeSync(1);		
  clockpin.writeSync(0);	
  result = 0;
  for (i = 0; i <= 9; i++) {
    clockpin.writeSync(1);		
    clockpin.writeSync(0);	
    result <<= 1;
    if (adc_out.readSync() == 1) {
      result |= 0x1;
    }
  }
  cspin.writeSync(1);		
  return result;
};

// return a random integer between min & max (inclusive) 
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

setInterval(function(){
/**
 * this stuff gets done once per second
 */

  // temporary code to flash one of the LEDs while testing
  //var j = getRandomInt(0,2);
  //j=2;
  //ledPin[j].writeSync(ledPin[j].readSync() === 0 ? 1 : 0);
  //ledState[j] = ledState[j] === 0 ? 1 : 0;
 
  // update all clients with analog input values
  var data,i = 0;
  // although there seems no need to declare data, this won't work
  // unless i is declared before entering the for loop ... WHY?
  for (i = 0; i <= 7; i++) {
        data = readAdc(i, clock, adc_in, adc_out, cs);
        io.sockets.emit('an'+i,data);    
  }
},1000);

io.on('connection', function (socket) {
   /**
    * this stuff runs when a new browser connection is made
    */
    var socketId = socket.id;
    var clientIp = socket.request.connection.remoteAddress;
    var clientPort = socket.request.connection.remotePort;
    socket.emit('ipaddr',clientIp);
    socket.emit('ipport',clientPort);
//    console.log(socket.request.connection)
//    console.log(clientPort)

    // update all LED indicators in the new client
    for (i=0; i<=2; i++) {
      //socket.emit('ledstatus',ledNumber,ledPin[ledNumber].readSync());
      socket.emit('ledstatus',i,ledState[i]);
    }
    
   /**
    * set up event handlers for events coming from this client
    * typically these will take some action then send an event
    * back to the client, and all other clients so that they can
    * update accordingly
    */
    
    socket.on('led', function(ledNumber,action) {
      switch (action) {
        case 0:
        case 1:
          ledPin[ledNumber].writeSync(action);
          ledState[ledNumber] = action;
          break;
        case 2:
          ledState[ledNumber] = ledState[ledNumber] === 0? 1 : 0;
          ledPin[ledNumber].writeSync(ledState[ledNumber]);
          break;
      }
    });
});
