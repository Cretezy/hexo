require('dotenv').config();

const nodeshout = require("nodeshout");
const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const express = require("express");
const path = require("path");
const songs = require('./songs');


// Setup nodeshout
nodeshout.init();

const shout = nodeshout.create();

shout.setHost(process.env.ICECAST_HOST);
shout.setPort(process.env.ICECAST_PORT);
shout.setUser(process.env.ICECAST_USER);
shout.setPassword(process.env.ICECAST_PASS);
shout.setMount(process.env.ICECAST_MOUNT);
shout.setFormat(1); // 0=ogg, 1=mp3
shout.setAudioInfo('bitrate', '128');
shout.setAudioInfo('samplerate', '44100');
shout.setAudioInfo('channels', '2');

if (shout.open() !== 0) {
    console.log("Could not connect")
}


function stream(source, callback) {
    console.log('Starting to play', source.name, source.path);
    switch (source.type) {
        case  songs.types.LOCAL:
            // const fileStream = new nodeshout.FileReadStream(source.path, 4096 * 8);
            // const shoutStream = fileStream.pipe(new nodeshout.ShoutStream(shout));
            //
            // shoutStream.on('finish', () => {
            //     console.log('Finished playing', source.path);
            //     callback()
            // });

            fs.open(source.path, 'r', (error, fd) => {
                if (error) {
                    console.log(error.message);
                    return;
                }

                fs.fstat(fd, (error, stats) => {
                    if (error) {
                        console.log(error.message);
                        return;
                    }

                    const fileSize = stats.size,
                        bufferSize = fileSize;

                    let chunkSize = 4096,
                        bytesRead = 0;

                    function read() {
                        const buffer = new Buffer(bufferSize);

                        if ((bytesRead + chunkSize) > fileSize) {
                            chunkSize = (fileSize - bytesRead);
                        }

                        fs.read(fd, buffer, 0, chunkSize, bytesRead, (error, bytesRead_, buffer) => {
                            if (error) {
                                console.log(error);
                                return;
                            }

                            bytesRead += bytesRead_;

                            if (bytesRead_ > 0) {
                                shout.send(buffer, bytesRead_);
                                setTimeout(read, Math.abs(shout.delay()));
                            } else {
                                console.log('Finished playing', source.path);
                                fs.close(fd);
                                callback()
                            }
                        });
                    }

                    read();
                });
            });
            break;
        case songs.types.YOUTUBE:
            const video = youtubedl(source.path, ['--format=171'], {cwd: __dirname});
            const shoutStream = new nodeshout.ShoutStream(shout);

            shoutStream.on('finish', () => {
                console.log('Finished playing', source.path);
                callback();
            });

            ffmpeg(video)
                .audioCodec('libmp3lame')
                .format('mp3')
                .writeToStream(shoutStream, {end: true});
            break;
    }
}




const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const update = require('./socket')(io, songs);

function playSongs() {
    // Doesn't play same song twice
    const nextSong=songs.getNextSong();
    update();

    stream(nextSong, playSongs);
}

playSongs();


// Only serve build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, '..', 'web', 'build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'web', 'build', 'index.html'));
    });
}

server.listen(process.env.PORT || 9000, () => {
    console.log('Hexo started');
});


