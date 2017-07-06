//imports
const fs = require("fs");
const args = require("minimist")(process.argv.slice(2));

//processes an argument from minimist with default and flag options combined
const processArgs = (function(args, argName, defaultValue) {
  //value of the argument we're dealing with here
  const argsalue = args[argName];

  //return false if argument to ngiven at all
  if (argsalue) {
    //return given value if there is one other than a boolean (meaning that it wasn't given with content)
    return typeof argsalue === "string" ? argsalue : defaultValue;
  }
  return false;
}).bind(null, args);

//settings from command line
const fileNames = { //file names of in and output files
  input: args.i || "input.txt",
  output: processArgs("o", "output.txt"),
  log: processArgs("l", "main.log"),
  letterProbs: args.p || "letterProbs.json"
};
const maximumSquenceSearchLength = args.s || 10; //the length with which the search for matching pairs will begin
const verboseLogging = args.v || false; //flag for using more verbose logging output
const minimumCertainty = args.c || 10; //minimum certainty to get before accepting the current key length
const minimumPairSearchAmount = minimumCertainty * 2; //search at least this many pairs before checking with certainty
const encryptKey = typeof args.e === "string" ? args.e : false; //encryption key if given, makes it encrypt instead, useful for testing

//logs and uses file writing if set
const log = (function() {
  //create write stream for logging fiel if enabled
  if (fileNames.log) {
    var logFileWriter = fs.createWriteStream(fileNames.log);
  }

  //return logging function
  return function(msg) {
    //log to console
    console.log(msg);

    //write to log file if enabled
    if (fileNames.log) {
      logFileWriter.write(msg + "\n");
    }

    //return what we got for chaining
    return msg;
  };
})();
//same as log just that it's onyl activated if verbose logging is enabled
function logV(msg) {
  if (verboseLogging) {
    log(msg);
  }
}

//calculates the greatest common denominator of two numbers
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

//determines the key length from some data that was encrypted with it
function getKeyLength(data) {
  //precalc data length, will be using a lot
  const dataLength = data.length;

  //start off with no collected data
  let certainty = 0;

  //start with maximum piece length because they provice more accurate pair distances
  let pieceLength = maximumSquenceSearchLength;

  //histogram of pair distance GCDs
  const gcdHistrogram = [];

  //function that's used in reducing the histogram to update highest
  const findHighest = (obj, val, index) => {
    //new highest if higher than the current one
    if (val > obj.highestVal) {
      obj.secondHighestVal = obj.highestVal;
      obj.highestVal = val;
      obj.highestIndex = index;
    } else if (val > obj.secondHighestVal) {
      obj.secondHighestVal = val;
    }
  };

  //current highest and seoncd highest values, for tracking certainty
  const highest = {
    highestVal: 0,
    secondHighestVal: 0,
    highestIndex: -1
  };

  //until certainty is reached
  do {
    //go through data and put into object as props
    const pieces = {};
    for (let i = 0; i < dataLength - pieceLength; i ++) {
      //get curret data piece
      const piece = data.substr(i, pieceLength);

      //check if already in pieces
      if (pieces.hasOwnProperty(piece)) {
        //add position to existing list of positions
        pieces[piece].push(i);
      } else {
        //add as new entry
        pieces[piece] = [i];
      }
    }

    //iterate all pieces
    for (const piece in pieces) {
      //get current array of positions for this piece
      const positions = pieces[piece];

      //not interesting if there's only one
      if (positions.length >= 2) {
        //go through all consecutive pairs
        for (let i = 0; i < positions.length - 1; i++) {
          //put current gcd result into histogram
          const gcdResult = gcd(positions[i], positions[i + 1]);

          //new histogram entry if not already one there
          gcdHistrogram[gcdResult] = (gcdHistrogram[gcdResult] || 0) + 1;
        }
      }
    }

    //update highest and second highest value with histogram
    gcdHistrogram.forEach(findHighest.bind(null, highest));
    logV(gcdHistrogram);
    logV(highest);
    //calculate current certainty from highest and second highest
    certainty = highest.highestVal / highest.secondHighestVal;

    //decrement piece length
    pieceLength --;
  } while (certainty < minimumCertainty && pieceLength >= 2);

  //return key length: index of most occuring gcd of pair distances
  return highest.highestIndex;
}

//determines the key with given key length and a letter probability distribution to match
function getKey(keyLength, data, probs) {

}

//strips the input of anything but spaces and letters, also converts to upper case
function prepare(str) {
  return str
    .replace(/_/g, " ")
    .replace(/[^a-z ]/igm, "")
    .toUpperCase();
}

//similar to prepare just that it's run after the processing is done
function postProcess(data) {
  return data.replace(" ", "_");
}

//returns a normalized char code int
function getCharCode(str, position) {
  //position is 0 if not given
  position = position || 0;

  //char code at position after subtracting 64 to make A:1
  const number = str.charCodeAt(position) - 64;

  //return char code if above 0, otherwise must be space and return 0
  return Math.max(number, 0);
}

//makes a string from a char code int
function fromCharCode(number) {
  //return space for 0 and add 64 with normal fromCharCode for all others
  return number ? String.fromCharCode(number + 64) : " ";
}

//uses the vigenere code to encode or decode
function code(data, key, doEncode) {
  //prepare data
  data = prepare(data);

  //convert key to int array
  key = prepare(key).split("").map((c) => getCharCode(c));
  const keyLength = key.length;

  //make direction factor from codex direction flag
  const directionFactor = doEncode ? 1 : -1;

  //how many chars our alphabet has (26 for letters + space = 27)
  const alphabetLength = 27;

  //accumulator of processed string
  let out = "";

  //for all chars of string
  for (let i = 0, len = data.length; i < len; i ++) {
    out += fromCharCode(
      (getCharCode(data, i) + //get as char code
       directionFactor * key[i % keyLength] + //add shift from key with factored direction
       alphabetLength) % alphabetLength); //add alphabet length and wrap around
  }

  //return generated string
  return out;
}

//decodes data with given key
function decode(data, key) {
  return postProcess(code(data, key, false));
}

//encrypts with given key instead of decrypting
function encrypt(data, key, callback) {
  callback(postProcess(code(data, key, true)));
}

//does all the decryption work
function decrypt(data, callback) {
  //load letter probabilities
  fs.readFile(fileNames.letterProbs, (err, dataProbs) => {
    //throw error if there is one
    if (err) {
      throw err;
    }

    //convert to object from json
    const letterProbabilities = JSON.parse(dataProbs.toString());

    //get the key length and key itself with key length and data
    const key = getKey(getKeyLength(data), data, letterProbabilities);

    //prepare data
    data = prepare(data);

    //return decoded data
    callback(decode(data, key));
  });
}

//processes data, uses encryption if key given is truthy
function processData(data, encryptKey, callback) {
  if (encryptKey) {
    encrypt(data, encryptKey, callback);
  } else {
    decrypt(data, callback);
  }
}

//load file from given input
logV("Loading input file...");
fs.readFile(fileNames.input, (err, data) => {
  //throw error if there is one
  if (err) {
    throw err;
  }

  //get string from data
  data = data.toString();

  //get processed data
  logV("Processing data: " + (encryptKey ? "Encrypting with key: \n" + encryptKey : "Decrypting without key: Searching for key..."));
  processData(data, encryptKey, (processed) => {
    //if enabled write to file
    if (fileNames.output) {
      logV("Writing data to file: " + fileNames.output);
      fs.writeFile(fileNames.output, processed, (err) => {
        if (err) {
          throw err;
        }
      });
    } else {
      //log in console
      log("Processed data:\n" + processed);
    }
  });
});
