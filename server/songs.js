const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const nodeshout = require("nodeshout");
const uuid = require('uuid/v4');
const Stream = require('stream');
const async = require("async");

module.exports = (state) => {
    let shout;
    let shoutStream;
    let shoutStreamClosed = true;

    function newShoutStream() {
        shoutStream = new Stream.Writable();
        shoutStream._write = (chunk, encoding, next) => {
            shoutStreamClosed = false;
            const sent = shout.send(chunk, chunk.length);
            if (sent !== nodeshout.ErrorTypes.SUCCESS) {
                console.log("Could not send", getShoutErrorCode(sent));
                // if (sent === nodeshout.ErrorTypes.SOCKET) {
                //     // Try to make new socket
                //     newShout()
                // }
            }

            const delay = Math.abs(shout.delay());
            console.log(chunk.length, delay);
            setTimeout(next, delay);
        };
    }

    function stream(source, next) {
        let stopped = false;
        if (shoutStreamClosed) {
            newShoutStream();
        }
        console.log('Starting to play', source.title, source.path);

        const fileStream = fs.createReadStream("cache/" + source.uuid + ".ogg");

        fileStream.pipe(shoutStream);

        shoutStream.on("finish", () => {
            if (!stopped) {
                shoutStreamClosed = true;
                next()
            }
        });

        return {
            source,
            stop: () => {
                stopped = true;
                console.log("Stopped");
                // clearTimeout(timer);
                try {
                    fileStream.unpipe(shoutStream);
                    fileStream.destroy();
                    fileStream.close();
                } catch (e) {
                    console.log("eeehhh", e)
                }
            },
        };
    }


    const songs = [
        {path: "Wmjpp0_6kb0", type: "YOUTUBE"},
        {path: "Aq81qz-iA-o", type: "YOUTUBE"},
        // {path: "Zhm9E29XZTQ", type: "YOUTUBE"},
    ];

    state.queue = [];

    function newShout() {
        console.log("Creating new shout socket");
        nodeshout.init();
        shout = nodeshout.create();

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
    }

    state.addToQueue = (song, justId, done = noop, gotTitle = noop) => {
        console.log("Adding to queue", song);
        song.votes = 0;
        song.ready = false;
        const youtube = getYoutubeId(song.path);
        const soundcloud = getSoundcloudId(song.path);

        if (!(youtube || soundcloud) && !justId) {
            // Could not parse id
            done();
        } else {
            // Clean youtube url
            if (youtube) {
                song.path = youtube; // "https://www.youtube.com/watch?v="
            }
            if (soundcloud) {
                song.path = soundcloud; // "https://soundcloud.com/"
            }

            // Check if in cache
            readCache((cache) => {
                const cached = cache.find((cacheSong) => cacheSong.path === song.path);

                if (cached) {
                    // It's in the cache!
                    song.title = cached.title;
                    song.uuid = cached.uuid;
                    song.duration = cached.duration;
                    song.durationInt = cached.durationInt;
                    song.by = cached.by;
                    song.type = cached.type;
                    song.ready = true;
                    state.queue.push(song);
                    state.events.emit("updateQueue");
                    console.log("Already cached", song.title);
                    gotTitle();
                    done();
                } else {
                    song.uuid = uuid();

                    // Add to cache
                    const cachePath = "cache/" + song.uuid + ".ogg";
                    let index = -1;

                    fs.exists(cachePath, (exist)=>{
                        const go = () =>{
                            const cancel = (error) => {
                                console.log(error);

                                console.log("ERROR CACHING", error);
                                if (index !== -1) {
                                    state.queue.splice(index, 1);
                                    state.events.emit("updateQueue");
                                }
                            };
                            let format;
                            let url;

                            if (youtube) {
                                song.type = "YOUTUBE";
                            }
                            if (soundcloud) {
                                song.type = "SOUNDCLOUD";
                            }

                            if (song.type === "YOUTUBE") {
                                format = '171';
                                url = "https://www.youtube.com/watch?v=" + song.path
                            }

                            if (song.type === "SOUNDCLOUD") {
                                format = 'http_mp3_128_url';
                                url = "https://soundcloud.com/" + song.path
                            }

                            try {
                                const video = youtubedl(url, [
                                    '-x',
                                    '--audio-format=vorbis',
                                    '--proxy=96.239.193.243:8080',
                                    // '--proxy=66.109.41.235:80',
                                    // '--proxy=201.16.140.205:80',
                                    '--format=' + format,
                                ], {cwd: __dirname});

                                video
                                    .on('info', (info) => {
                                        const timePart = info.duration.split(":").reverse();
                                        const seconds = parseInt(timePart[0]);
                                        const minutes = timePart.length >= 2 ? parseInt(timePart[1]) : 0;
                                        const hours = timePart.length >= 3 ? parseInt(timePart[2]) : 0;
                                        const totalSeconds = seconds + ((minutes + (hours * 60)) * 60);

                                        function pad(time) {
                                            return "00".substring(0, 2 - time.length) + time
                                        }

                                        let time = pad(minutes.toString()) + ":" + pad(seconds.toString());
                                        if (hours !== 0) {
                                            time = pad(hours.toString()) + ":" + time
                                        }

                                        song.title = info.title;
                                        song.duration = time;
                                        song.durationInt = totalSeconds;

                                        index = state.length;
                                        state.queue.push(song);

                                        state.events.emit("updateQueue");
                                        gotTitle();
                                    })
                                    .on('error', cancel);
                                const transcode = ffmpeg(video);
                                transcode
                                    .noVideo()
                                    .audioCodec('libvorbis')
                                    .format('ogg')
                                    .on('end', () => {
                                        // fs.unlinkSync(cachePathPart);
                                        readCache((cache) => {
                                            cache.push({
                                                title: song.title,
                                                duration: song.duration,
                                                durationInt: song.durationInt,
                                                by: song.by,
                                                uuid: song.uuid,
                                                path: song.path,
                                                type: song.type
                                            });

                                            writeCache(cache, () => {
                                                song.ready = true;
                                                state.events.emit("updateQueue");
                                                done()
                                            })
                                        })
                                    })
                                    .on('error', cancel)
                                    .save(cachePath);
                            } catch (e) {
                                cancel(e);
                            }
                        };

                        if(exist){
                            fs.unlink(cachePath, go);
                        }else{
                            go();
                        }
                    })


                }
            });
        }
    };

    state.playing = null;

    state.playNextSong = () => {

        let last = null;
        if (state.playing) {
            last = state.playing;
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

        if (last) {
            last.stop();
        }

        state.playing = stream(
            nextSong, state.playNextSong);
        state.events.emit("updateCurrent");
        state.events.emit("updateQueue");
    };



    if (!fs.existsSync("cache")){
        fs.mkdirSync("cache");
    }

    const addingToQueue = [];
    songs.forEach((song) => {
        song.by = "BOT";
        addingToQueue.push((callback) => {
            state.addToQueue(song, true, callback);
        })
    });

    readCache((cache) => {
        cache.forEach((cachedSong) => {
            if (!songs.find((song) => song.path === cachedSong.path)) {
                addingToQueue.push((callback) => {
                    state.addToQueue({
                        path: cachedSong.path,
                    }, true, callback);
                })
            }
        });
        async.parallel(addingToQueue,
            () => {
                newShout();
                state.playNextSong();

                setTimeout(() => {
                    state.events.emit("reload")
                }, 3000);
            });
    });
};

function getYoutubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}
function getSoundcloudId(url) {
    const regExp = /^.*(soundcloud\.com\/)([^\/]+)\/([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match.length >= 4) ? match[2] + "/" + match[3] : false;
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
            callback([])
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
