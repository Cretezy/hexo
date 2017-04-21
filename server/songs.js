const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const nodeshout = require("nodeshout");
const uuid = require('uuid/v4');

module.exports = (state) => {
    state.types = {
        LOCAL: 0,
        YOUTUBE: 1
    };

    function stream(source, callback_) {
        console.log('Starting to play', source.name, source.path);
        let called = false;
        const callback = () =>{
            if(!called){
                called = true;
                callback_();
            }
        };
        switch (source.type) {
            case  state.types.LOCAL:
                // const fileStream = new nodeshout.FileReadStream(source.path, 4096 * 8);
                // const shoutStream = fileStream.pipe(new nodeshout.ShoutStream(shout));
                //
                // shoutStream.on('finish', () => {
                //     console.log('Finished playing', source.path);
                //     callback()
                // });

                let stopped = false;

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
                                if (stopped) {
                                    fs.close(fd);
                                    return;
                                }

                                bytesRead += bytesRead_;

                                if (bytesRead_ > 0) {
                                    state.shout.send(buffer, bytesRead_);
                                    setTimeout(read, Math.abs(state.shout.delay()));
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

                return {
                    source,
                    stop: () => {
                        stopped = true;
                    }
                };
            case state.types.YOUTUBE:
                const video = youtubedl(source.path, [
                    '-x',
                    '--audio-format', 'mp3',
                    '--proxy', '201.16.140.205:80'
                ], {cwd: __dirname});
                const shoutStream = new nodeshout.ShoutStream(state.shout);

                shoutStream.on('end', () => {
                    // Not called?
                    console.log('End playing', source.name, source.path);
                    // callback();
                });
                shoutStream.on('finish', () => {
                    // Called when skipped (late) and finish (late)
                    console.log('Finished playing', source.name, source.path);
                    // callback();
                });

                const transcode = ffmpeg(video);
                transcode.audioCodec('libmp3lame')
                    .format('mp3')
                    .on('end', function () {
                        // Called when finish (early)
                        console.log('Finished TRANSCODE playing', source.name, source.path);
                        callback();
                    })
                    .on('error', () => {
                        // Called when skipped
                        console.log('Skipped playing', source.name, source.path);
                        callback();
                    })
                    .writeToStream(shoutStream, {end: true});
                return {
                    source,
                    stop: () => {
                        // called = true;
                        // shoutStream.emit('end')
                        transcode.kill();
                    }
                }

        }
    }


    const songs = [
        // {name: "wHere dA blOW", path: "./songs/skimask-wheredablow.mp3", type: state.types.LOCAL},
        // {name: "lOok aT meEEE", path: "./songs/xxxtentacion-lookatme.mp3", type: state.types.LOCAL},
        // {name: "sidEeAlkS", path: "./songs/theweeknd-sidewalks.mp3", type: songs.state.types.LOCAL},
        {path: "https://www.youtube.com/watch?v=Wmjpp0_6kb0", type: state.types.YOUTUBE},
        {path: "https://www.youtube.com/watch?v=Aq81qz-iA-o", type: state.types.YOUTUBE},
        // {path: "https://www.youtube.com/watch?v=Co0tTeuUVhU", type: state.types.YOUTUBE},
    ];

    state.current = null;
    state.queue = [];

    state.songsManager = {};

    state.songsManager.addToQueue = (song) => {
        song.votes = 0;
        song.uuid = uuid();
        const index = state.queue.length
        state.queue.push(song);
        state.youtube.videos.list({
            id: youtube_parser(song.path),
            part: 'snippet',
        }, function (err, data, response) {
            if (err || response.statusCode !== 200 || data.items.length === 0) {
                // ehh something wrong, delete
                delete state.queue[index];
            } else {
                song.title = data.items[0].snippet.title;
            }
            state.events.emit("updateSongList");
        });
    };

    state.songsManager.playNextSong = () => {
        console.log("NEXT")
        if (state.current) {
            try {
                // state.current.stop()
            } catch (e) {
            }
        }
        let nextSongIndex = -1;
        let totalVotes = 0;
        state.queue.forEach((song, index) => {
            if (nextSongIndex === -1) {
                nextSongIndex = index;
            } else {
                if (song.votes > state.queue[nextSongIndex].votes) {
                    nextSongIndex = index;
                }
            }
            totalVotes += song.votes;
        });
        let nextSong;
        if (totalVotes === 0) {
            console.log("RANDOM")
            nextSong = state.queue[Math.floor(Math.random() * state.queue.length)];
        } else {
            nextSong = state.queue[nextSongIndex];
        }
        nextSong.votes = 0;
        // state.queue.push(nextSong);
        state.current = stream(nextSong, state.songsManager.playNextSong);
        state.events.emit("play");
    };

    songs.forEach((song) => {
        song.by = "BOT  ";
        state.songsManager.addToQueue(song)
    });
};

function youtube_parser(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

