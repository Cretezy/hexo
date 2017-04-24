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
                            console.log("Error sending", getShoutErrorCode(send));
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


                // const cachePath = "cache/" + source.path;
                // let downloaded = 0;
                // if (fs.existsSync(cachePath)) {
                //     downloaded = fs.statSync(cachePath).size;
                // }
                //
                // const video = youtubedl("https://www.youtube.com/watch?v=" + source.path, [
                //     '-x',
                //     '--audio-format=vorbis',
                //     '--proxy=96.239.193.243:8080',
                //     // '--proxy=66.109.41.235:80',
                //     // '--proxy=201.16.140.205:80',
                //     '--format=171',
                //     '--no-cache-dir'
                // ], {cwd: __dirname});
                //
                // let transcode = null;
                // let cache;
                // let totalSeconds;
                // video.on('info', function (info) {
                //     const timePart = info.duration.split(":").reverse();
                //     const seconds = parseInt(timePart[0]);
                //     const minutes = timePart.length >= 2 ? parseInt(timePart[1]) : 0;
                //     const hours = timePart.length >= 3 ? parseInt(timePart[2]) : 0;
                //     totalSeconds = seconds + ((minutes + (hours * 60)) * 60);
                //
                //     const metadata = nodeshout.createMetadata();
                //     metadata.add('song', info.title);
                //     // state.shout.setMetadata(metadata); // BREAKS SOCKET SENDING (?)
                //     if (downloaded > 0 && info.size === downloaded) {
                //         console.log("Using cached")
                //         setTimeout(() => {
                //             try {
                //                 // XXX: Cancel video download
                //                 video.pause();
                //                 video.emit('end');
                //                 video.close()
                //             } catch (e) {
                //             }
                //         }, 1);
                //         cache = true;
                //     } else {
                //         cache = false;
                //     }
                readCache((cache) => {
                    if (source.path in cache) {
                        // It's in the cache!
                        console.log("PLAYING FROM CACHE", source.title)

                        isReady = true;
                        ready();

                    } else {
                        console.log("NOT IN CACHE")
                    }
                });
                let transcode;
                const play = () => {
                    // Wait until ready
                    if (!isReady) {
                        setTimeout(play, 50);
                        return;
                    }
                    try {
                        transcode = ffmpeg("cache/" + source.path + ".ogg");
                        transcode
                            .noVideo()
                            .audioCodec('libvorbis')
                            .format('ogg')
                            .on('error', () => {
                            })
                            .writeToStream(converter, {end: true});
                    } catch (e) {

                    }

                    preloadTimer = setTimeout(() => {
                        console.log("Preload Timer");
                        preload();
                    }, (source.duration - 5) * 1000);

                    finishTimer = setTimeout(() => {
                        console.log("Finish Timer");
                        finished();
                    }, (source.duration - 1) * 1000);
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
            console.log("Could not connect to icecast", getShoutErrorCode(code))
        }
        state.shout = shout;
    };

    state.songsManager.addToQueue = (song, callback = noop, gotTitle = noop) => {
        song.votes = 0;
        song.uuid = uuid();
        song.ready = false;
        song.path = getYoutubeId(song.path);

        if (song.path === false) {
            // Could not parse id
            callback();
        } else {
            // Get youtube title
            // state.youtube.videos.list({
            //     id: song.path,
            //     part: 'snippet',
            // }, (err, data, response) => {
            //     if (err || response.statusCode !== 200 || data.items.length === 0) {
            //         // Not a youtube video
            //     } else {
            //         song.title = data.items[0].snippet.title;
            //         state.queue.push(song);
            //         state.events.emit("update");
            //     }
            //     callback && callback();
            // });

            // Check if in cache
            readCache((cache) => {
                if (song.path in cache) {
                    // It's in the cache!
                    song.title = cache[song.path].title;
                    song.duration = cache[song.path].duration;
                    song.ready = true;
                    state.queue.push(song);
                    state.events.emit("updateQueue");
                    console.log("Already cached", song.title);
                    gotTitle();
                    callback();
                } else {
                    // Add to cache
                    let downloaded = 0;
                    const cachePath = "cache/" + song.path + ".ogg";
                    if (fs.existsSync(cachePath)) {
                        downloaded = fs.statSync(cachePath).size;
                    }
                    let index = -1;
                    try {
                        const video = youtubedl("https://www.youtube.com/watch?v=" + song.path, [
                            '-x',
                            '--audio-format=vorbis',
                            // '--proxy=96.239.193.243:8080',
                            // '--proxy=66.109.41.235:80',
                            // '--proxy=201.16.140.205:80',
                            '--format=171',
                            '--no-cache-dir'
                        ], {start: downloaded, cwd: __dirname});

                        video.on('info', (info) => {
                            console.log("Starting cached", song.path);

                            const total = info.size + downloaded;
                            console.log('Total size: ' + total);
                            const timePart = info.duration.split(":").reverse();
                            const seconds = parseInt(timePart[0]);
                            const minutes = timePart.length >= 2 ? parseInt(timePart[1]) : 0;
                            const hours = timePart.length >= 3 ? parseInt(timePart[2]) : 0;
                            const totalSeconds = seconds + ((minutes + (hours * 60)) * 60);

                            song.title = info.title;
                            song.duration = totalSeconds;
                            index = state.length;
                            state.queue.push(song);
                            state.events.emit("updateQueue");
                            gotTitle();

                            if (downloaded > 0) {
                                console.log('Resuming from: ' + downloaded);
                                console.log('Remaining bytes: ' + info.size);
                            }
                        });
                        video.on('end', () => {
                            'use strict';
                            console.log('finished downloading', song.path);


                            readCache((cache) => {
                                cache[song.path] = {
                                    title: song.title,
                                    duration: song.duration,
                                    by: song.by
                                };

                                writeCache(cache, () => {
                                    song.ready = true;
                                    state.events.emit("updateQueue");
                                    callback()
                                })
                            })
                        });
                        video.pipe(fs.createWriteStream(cachePath, {flags: 'w'}));
                    } catch (e) {
                        fs.unlinkSync(cachePath);
                        console.log("ERROR CACHING", e);
                        if (index !== -1) {
                            state.queue.splice(index, 1);
                            state.events.emit("updateQueue");
                        }
                    }
                }
            });
        }
    };
    state.loading = null;
    state.playing = null;

    state.songsManager.playNextSong = (skip = false) => {
        if (state.loading && state.playing && state.loading.source.uuid !== state.playing.source.uuid) {
            return
        }

        console.log("Preloading", skip);

        let last = null;
        if (state.current) {
            last = state.current;
        }

        // Get next song to play (more votes, or random but not twice in a row)
        let nextSongIndex = -1;
        let totalVotes = 0;
        const queueReady = state.queue.filter((song) => song.ready);

        queueReady.forEach((song, index) => {
            if (nextSongIndex === -1) {
                nextSongIndex = index;
            } else {
                if (song.votes > queueReady[nextSongIndex].votes) {
                    nextSongIndex = index;
                }
            }
            totalVotes += song.votes;
        });
        let nextSong;
        if (totalVotes === 0) {
            const queue = last ? queueReady.filter((song) => song.uuid !== last.source.uuid) : queueReady;
            nextSong = queue[Math.floor(Math.random() * queue.length)];
        } else {
            nextSong = queueReady[nextSongIndex];
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
                state.events.emit("updateCurrent");
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
        state.events.emit("updateCurrent");
        state.events.emit("updateQueue");

    };


    const addingToQueue = [];
    songs.forEach((song) => {
        song.by = "BOT";
        addingToQueue.push((callback) => {
            state.songsManager.addToQueue(song, callback);
        })
    });

    readCache((cache) => {
        Object.keys(cache).forEach((path) => {
            if (!songs.find((song) => song.path === "https://www.youtube.com/watch?v=" + path)) {
                addingToQueue.push((callback) => {
                    state.songsManager.addToQueue({
                        path: "https://www.youtube.com/watch?v=" + path,
                        type: state.types.YOUTUBE,
                        by: cache[path].by
                    }, callback);
                })
            }
        });
        async.parallel(addingToQueue,
            () => {
                state.songsManager.newShout();
                state.events.emit("reload");
                state.songsManager.playNextSong();
            });
    });


};

function getYoutubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

function getShoutErrorCode(code) {
    return Object.keys(nodeshout.ErrorTypes).find((key) => {
        return code === nodeshout.ErrorTypes[key]
    })
}

const cacheFilePath = 'cache/cache.json';
function readCache(callback) {
    fs.exists(cacheFilePath, (exist) => {
        if (!exist) {
            callback({})
        } else {
            fs.readFile(cacheFilePath, 'utf8', (error, data) => {
                if (error) {
                    throw error;
                }
                callback(JSON.parse(data))
            });
        }
    })
}

function writeCache(data, callback) {
    fs.writeFile(cacheFilePath, JSON.stringify(data), 'utf8', (error) => {
        if (error) {
            throw error;
        }
        callback();
    });
}

function noop() {
}