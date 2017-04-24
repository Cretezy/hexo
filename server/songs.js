const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const nodeshout = require("nodeshout");
const uuid = require('uuid/v4');
const Stream = require('stream');
const async = require("async");

module.exports = (state) => {
    state.types = {
        LOCAL: 0,
        YOUTUBE: 1
    };


    function stream(source, preload, started, finished, ready) {
        console.log('Starting to play', source.title, source.path);
        let hasStopped = false;
        let hasStarted = false;
        let isReady = false;


        let preloadTimer;
        let finishTimer;
        switch (source.type) {
            // case  state.types.LOCAL:
            //     // const fileStream = new nodeshout.FileReadStream(source.path, 4096 * 8);
            //     // const shoutStream = fileStream.pipe(new nodeshout.ShoutStream(shout));
            //     //
            //     // shoutStream.on('finish', () => {
            //     //     console.log('Finished playing', source.path);
            //     //     callback()
            //     // });
            //
            //
            //     fs.open(source.path, 'r', (error, fd) => {
            //         if (error) {
            //             console.log(error.message);
            //             return;
            //         }
            //
            //         fs.fstat(fd, (error, stats) => {
            //             if (error) {
            //                 console.log(error.message);
            //                 return;
            //             }
            //
            //             const fileSize = stats.size,
            //                 bufferSize = fileSize;
            //
            //             let chunkSize = 4096,
            //                 bytesRead = 0;
            //
            //             function read() {
            //                 const buffer = new Buffer(bufferSize);
            //
            //                 if ((bytesRead + chunkSize) > fileSize) {
            //                     chunkSize = (fileSize - bytesRead);
            //                 }
            //
            //                 fs.read(fd, buffer, 0, chunkSize, bytesRead, (error, bytesRead_, buffer) => {
            //                     if (error) {
            //                         console.log(error);
            //                         return;
            //                     }
            //                     if (hasStopped) {
            //                         fs.close(fd);
            //                         return;
            //                     }
            //
            //                     bytesRead += bytesRead_;
            //
            //                     if (bytesRead_ > 0) {
            //                         state.shout.send(buffer, bytesRead_);
            //                         setTimeout(read, Math.abs(state.shout.delay()));
            //                     } else {
            //                         console.log('Finished playing', source.path);
            //                         fs.close(fd);
            //                         callback()
            //                     }
            //                 });
            //             }
            //
            //             read();
            //         });
            //     });
            //
            //     return {
            //         source,
            //         stop: () => {
            //             stopped = true;
            //         }
            //     };
            case state.types.YOUTUBE:
                const converter = new Stream.Writable();
                converter._write = (chunk, enc, next) => {
                    if (!hasStopped) {
                        if (!hasStarted) {
                            hasStarted = true;
                            started();
                        }
                        const send = state.shout.send(chunk, chunk.length);
                        if (send !== nodeshout.ErrorTypes.SUCCESS) {
                            console.log("Error sending", get_error_code(send));
                        }

                        const delay = state.shout.delay();
                        setTimeout(next, Math.abs(delay));
                        console.log("data", source.title, chunk.length, delay);
                    } else {
                        // next('a'); // crash it?
                    }
                };


                converter.on('error', () => {
                });

                converter.on('finish', () => {
                    console.log("finisshhh");
                    finished();
                });


                const cachePath = "cache/" + source.path;
                let downloaded = 0;
                if (fs.existsSync(cachePath)) {
                    downloaded = fs.statSync(cachePath).size;
                }

                const video = youtubedl("https://www.youtube.com/watch?v=" + source.path, [
                    '-x',
                    '--audio-format=vorbis',
                    '--proxy=201.16.140.205:80',
                    '--format=171'
                ], {cwd: __dirname});

                let transcode = null;
                let cache;
                let totalSeconds;
                video.on('info', function (info) {
                    const timePart = info.duration.split(":").reverse();
                    const seconds = parseInt(timePart[0]);
                    const minutes = timePart.length >= 2 ? parseInt(timePart[1]) : 0;
                    const hours = timePart.length >= 3 ? parseInt(timePart[2]) : 0;
                    totalSeconds = seconds + ((minutes + (hours * 60)) * 60);

                    const metadata = nodeshout.createMetadata();
                    metadata.add('song', info.title);
                    // state.shout.setMetadata(metadata); // BREAKS SOCKET SENDING (?)
                    if (downloaded > 0 && info.size === downloaded) {
                        console.log("Using cached")
                        setTimeout(() => {
                            try {
                                // XXX: Cancel video download
                                video.pause();
                                video.emit('end');
                                video.close()
                            } catch (e) {
                            }
                        }, 1);
                        cache = true;
                    } else {
                        cache = false;
                    }

                    isReady = true;
                    ready();
                });

                const play = () => {
                    // Wait until ready
                    if (!isReady) {
                        setTimeout(play, 50);
                        return;
                    }

                    let nextStream;
                    if (cache) {
                        // Read from cache
                        nextStream = cachePath;
                    } else {
                        // Read from Youtube and add to cache
                        if (fs.existsSync(cachePath)) {
                            fs.unlinkSync(cachePath); // Delete old
                        }
                        const passthrough = new Stream.PassThrough();
                        video.pipe(passthrough);
                        passthrough.pipe(fs.createWriteStream(cachePath, {flags: 'w'}));
                        nextStream = passthrough;
                    }

                    transcode = ffmpeg(nextStream);
                    transcode
                        .noVideo()
                        .audioCodec('libvorbis')
                        .format('ogg')
                        .on('error', () => {
                        })
                        .writeToStream(converter, {end: true});

                    preloadTimer = setTimeout(() => {
                        console.log("Preload Timer");
                        preload();
                    }, (totalSeconds - 15) * 1000);

                    finishTimer = setTimeout(() => {
                        console.log("Finish Timer");
                        finished();
                    }, (totalSeconds - 1) * 1000);
                };

                return {
                    source,
                    stop: () => {
                        console.log("Stopped");
                        setTimeout(() => {
                            try {
                                transcode.kill()
                            } catch (e) {
                            }
                        }, 1);
                        hasStopped = true;
                        preloadTimer && clearTimeout(preloadTimer);
                        finishTimer && clearTimeout(finishTimer);
                    },
                    play,
                }
        }
    }


    const songs = [
        // {name: "wHere dA blOW", path: "./songs/skimask-wheredablow.mp3", type: state.types.LOCAL},
        // {name: "lOok aT meEEE", path: "./songs/xxxtentacion-lookatme.mp3", type: state.types.LOCAL},
        // {name: "sidEeAlkS", path: "./songs/theweeknd-sidewalks.mp3", type: songs.state.types.LOCAL},
        {path: "https://www.youtube.com/watch?v=Wmjpp0_6kb0", type: state.types.YOUTUBE},
        {path: "https://www.youtube.com/watch?v=Aq81qz-iA-o", type: state.types.YOUTUBE},
        {path: "https://www.youtube.com/watch?v=Zhm9E29XZTQ", type: state.types.YOUTUBE},
        // {path: "https://www.youtube.com/watch?v=Zhm9E29XZTQ", type: state.types.YOUTUBE},
        // {path: "https://www.youtube.com/watch?v=Co0tTeuUVhU", type: state.types.YOUTUBE},
    ];

    state.current = null;
    state.queue = [];

    state.songsManager = {};
    state.songsManager.newShout = () => {
        console.log("Creating new shout socket");
        nodeshout.init();
        const shout = nodeshout.create();

        shout.setHost(process.env.ICECAST_HOST);
        shout.setPort(process.env.ICECAST_PORT);
        shout.setUser(process.env.ICECAST_USER);
        shout.setPassword(process.env.ICECAST_PASS);
        shout.setMount(process.env.ICECAST_MOUNT);
        shout.setFormat(0); // 0=ogg, 1=mp3
        shout.setAudioInfo('bitrate', '128');
        shout.setAudioInfo('samplerate', '44100');
        shout.setAudioInfo('channels', '2');

        const code = shout.open();
        if (code !== nodeshout.ErrorTypes.SUCCESS) {
            console.log("Could not connect to icecast", get_error_code(code))
        }
        state.shout = shout;
    };

    state.songsManager.addToQueue = (song, callback) => {
        song.votes = 0;
        song.uuid = uuid();
        song.path = youtube_parser(song.path);
        if (song.path === false) {
            // Could not parse id
            callback && callback();
        } else {
            // Get youtube title
            state.youtube.videos.list({
                id: song.path,
                part: 'snippet',
            }, (err, data, response) => {
                if (err || response.statusCode !== 200 || data.items.length === 0) {
                    // Not a youtube video
                } else {
                    song.title = data.items[0].snippet.title;
                    state.queue.push(song);
                    state.events.emit("update");
                }
                callback && callback();
            });
        }
    };
    state.loading = null;
    state.playing = null;

    state.songsManager.playNextSong = (skip = false) => {
        console.log("Preloading", skip);

        let last = null;
        if (state.current) {
            last = state.current;
        }

        // Get next song to play (more votes, or random but not twice in a row)
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
            const queue = last ? state.queue.filter((song) => song.uuid !== last.source.uuid) : state.queue;
            nextSong = queue[Math.floor(Math.random() * queue.length)];
        } else {
            nextSong = state.queue[nextSongIndex];
        }

        // Reset votes
        nextSong.votes = 0;

        let finishedCalled = false;
        let stoppedCalled = false;
        const current = state.current = state.loading = stream(
            nextSong, // Source
            state.songsManager.playNextSong, // Preload
            () => {
                // Started
                console.log("XStarted", current.source.title);
                if (last) {
                    if (!stoppedCalled) {
                        stoppedCalled = true;

                        try {
                            last.stop();
                        } catch (e) {
                        }
                    }
                }
                state.playing = current;
                state.events.emit("update");
            },
            () => {
                // Finished
                if (!finishedCalled) {
                    finishedCalled = true;
                    console.log("XFinished", current.source.title, state.current.source.title);

                    try {
                        current.stop();
                    } catch (e) {
                    }

                    state.current.play();
                }
            },
            () => {
                // Ready
                console.log("XReady", state.current.source.title);
                if (skip) {
                    if (!stoppedCalled) {
                        stoppedCalled = true;
                        try {
                            last.stop();
                        } catch (e) {
                        }
                    }
                    state.current.play();
                } else if (!last) {
                    state.current.play();
                }
            });
        state.events.emit("update");

    };

    const addingToQueue = [];
    songs.forEach((song) => {
        song.by = "BOT";
        addingToQueue.push((callback) => {
            state.songsManager.addToQueue(song, callback);
        })
    });

    async.parallel(addingToQueue,
        () => {
            state.songsManager.newShout();
            state.songsManager.playNextSong();
        });
}
;

function youtube_parser(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

function get_error_code(code) {
    return Object.keys(nodeshout.ErrorTypes).find((key) => {
        return code === nodeshout.ErrorTypes[key]
    })
}