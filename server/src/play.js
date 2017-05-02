const nodeshout = require("nodeshout");
const Writable = require('stream').Writable;
const EventEmitter = require('events');
const fs = require("fs");

module.exports = function (shout, filepath) {
    const events = new EventEmitter();
    let playing = true;

    console.log('Starting to play', filepath);

    const shoutStream = new Writable();
    shoutStream._write = (chunk, encoding, next) => {
        if (playing) {
            const sent = shout.send(chunk, chunk.length);
            if (sent !== nodeshout.ErrorTypes.SUCCESS) {
                const errorMessage = `Error sending to shout: ${getShoutErrorCode(sent)} (code ${sent})`;
                events.emit("error", new Error(errorMessage))
            }

            setTimeout(next, Math.abs(shout.delay()));
        }
    };
    shoutStream.on("finish", () => {
        if (playing) {
            playing = false;
            events.emit("finish")
        }
    });

    console.log(filepath)
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(shoutStream);
    fileStream.on('error', (error) => {
        events.emit("error", error)
    });

    events.on("stop", () => {
        playing = false;
        try {
            fileStream.unpipe(shoutStream);
            fileStream.destroy();
            fileStream.close();
        } catch (e) {
        }
    });

    return events;
};

// Get error code title
function getShoutErrorCode(code) {
    return Object.keys(nodeshout.ErrorTypes).find((key) => {
        return code === nodeshout.ErrorTypes[key]
    })
}