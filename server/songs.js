const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const nodeshout = require("nodeshout");

module.exports = (state) => {
    const types = {
        LOCAL: 0,
        YOUTUBE: 1
    };

    function stream(source, callback) {
        console.log('Starting to play', source.name, source.path);
        switch (source.type) {
            case  types.LOCAL:
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
            case types.YOUTUBE:
                const video = youtubedl(source.path, ['-x', '--audio-format', 'mp3'], {cwd: __dirname});
                const shoutStream = new nodeshout.ShoutStream(state.shout);

                shoutStream.on('end', () => {

                });

                const transcode = ffmpeg(video);
                setTimeout(()=>{
                    transcode.audioCodec('libmp3lame')
                        .format('mp3')
                        .on('end', function () {
                            console.log('Finished playing', source.path);
                            callback();
                        })
                        .on('error', () => {
                            // Killed
                        })
                        .writeToStream(shoutStream, {end: true});
                }, 1);
                return {
                    source,
                    stop: () => {
                        transcode.kill();
                    }
                }
        }
    }


    const songs = [
        // {name: "wHere dA blOW", path: "./songs/skimask-wheredablow.mp3", type: songs.types.LOCAL},
        // {name: "lOok aT meEEE", path: "./songs/xxxtentacion-lookatme.mp3", type: songs.types.LOCAL},
        // {name: "sidEeAlkS", path: "./songs/theweeknd-sidewalks.mp3", type: songs.types.LOCAL},
        // {name: "heartlessss", path: "https://www.youtube.com/watch?v=Co0tTeuUVhU", type: types.YOUTUBE},
        {name: "blooowww", path: "https://www.youtube.com/watch?v=Aq81qz-iA-o", type: types.YOUTUBE},
        {name: "look at mee", path: "https://www.youtube.com/watch?v=Wmjpp0_6kb0", type: types.YOUTUBE},
    ];

    state.current = null;
    state.songsManager = {};

    state.songsManager.getNextSong = () => {
        const futureSongs = state.songsManager.getFutureSongs();
        return futureSongs[Math.floor(Math.random() * futureSongs.length)];
    };

    state.songsManager.getFutureSongs = () => {
        return state.current === null
            ? songs
            : songs.filter((song) => {
                return song.path !== state.current.source.path;
            });
    };

    function playSongs() {
        if (state.current) {
            try {
                state.current.stop()
            } catch (e) {
            }
        }
        // Doesn't play same song twice
        const nextSong = state.songsManager.getNextSong();
        state.current = stream(nextSong, playSongs);
        state.events.emit("play");
    }

    state.songsManager.playNextSong = playSongs;
};

