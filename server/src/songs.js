const fs = require("fs");
const youtubedl = require('youtube-dl');
const ffmpeg = require('fluent-ffmpeg');
const nodeshout = require("nodeshout");
const uuid = require('uuid/v4');
const play = require('./play');
const async = require("async");
const path = require("path");

const cacheDir = path.resolve(__dirname, '..', 'cache');

module.exports = (state) => {
    // Shout socket
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

    const code = shout.open();
    if (code !== nodeshout.ErrorTypes.SUCCESS) {
        console.log("Could not connect to icecast", getShoutErrorCode(code))
    }

    // Default songs
    const songs = [
        {path: "Wmjpp0_6kb0", type: "YOUTUBE"},
        {path: "Aq81qz-iA-o", type: "YOUTUBE"},
        // {path: "Zhm9E29XZTQ", type: "YOUTUBE"}, // test song
    ];

    // Main queue
    state.queue = [];

    state.addToQueue = (song, skipType, done = noop, gotTitle = noop) => {
        console.log("Adding to queue", song);
        song.votes = 0;
        song.ready = false;
        const youtube = getYoutubeId(song.path);
        const soundcloud = getSoundcloudId(song.path);

        if (!(youtube || soundcloud) && !skipType) {
            // Could not parse id
            gotTitle("Could not parse URL");
            done();
        } else {
            // Clean paths and assign types
            if (youtube) {
                song.path = youtube; // "https://www.youtube.com/watch?v="
                song.type = "YOUTUBE";
            }

            if (soundcloud) {
                song.path = soundcloud; // "https://soundcloud.com/"
                song.type = "SOUNDCLOUD";
            }

            // Check if in cache
            readCache((cache) => {
                const cached = cache.find((cacheSong) => cacheSong.path === song.path);

                if (cached) {
                    // It's in the cache, use cached info
                    Object.assign(song, cached);

                    // Add to queue
                    song.ready = true;
                    state.queue.push(song);
                    state.events.emit("updateQueue");
                    gotTitle();
                    done();
                } else {
                    // Not in cache, time to cache
                    song.uuid = uuid();
                    const cachePath = path.resolve(cacheDir, song.uuid + ".mp3");

                    // Index in queue
                    let index = -1;
                    const cancel = (error) => {
                        console.log("Error while caching", error);
                        // If already in queue, let's remove it
                        if (index !== -1) {
                            state.queue.splice(index, 1);
                            state.events.emit("updateQueue");
                        }

                        gotTitle("Error while fetching song");
                        done();
                    };

                    const go = () => {
                        // youtube-dl settings
                        let dlFormat;
                        let dlUrl;

                        if (song.type === "YOUTUBE") {
                            dlFormat = '171';
                            dlUrl = "https://www.youtube.com/watch?v=" + song.path
                        }

                        if (song.type === "SOUNDCLOUD") {
                            dlFormat = 'http_mp3_128_url';
                            dlUrl = "https://soundcloud.com/" + song.path
                        }
                        const dlOptions = [
                            '-x',
                            '--audio-format=mp3',
                            // '--proxy=96.239.193.243:8080',
                            // '--proxy=66.109.41.235:80',
                            // '--proxy=201.16.140.205:80',
                            '--format=' + dlFormat,
                        ];

                        // youtube-dl proxy (e.g.: blocked ip)
                        if (process.env.YOUTUBE_PROXY) {
                            dlOptions.push("--proxy=" + process.env.YOUTUBE_PROXY);
                        }

                        try {
                            // Download youtube video and stream to ffmpeg
                            const video = youtubedl(dlUrl, dlOptions);

                            video
                                .on('info', (info) => {
                                    // Got song info

                                    // Pretty print time as 00:00
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

                                    // Set song info
                                    song.title = info.title;
                                    song.duration = time;
                                    song.durationInt = totalSeconds;

                                    // Add to temp queue
                                    index = state.length;
                                    state.queue.push(song);

                                    state.events.emit("updateQueue");
                                    gotTitle();
                                })
                                .on('error', cancel);

                            // Transcode to mp3
                            const transcode = ffmpeg(video);
                            transcode
                                .noVideo()
                                .audioCodec('libmp3lame')
                                .format('mp3')
                                .on('end', () => {
                                    // Done, let's add to cache
                                    readCache((cache) => {
                                        cache.push(song);

                                        writeCache(cache, () => {
                                            song.ready = true;
                                            state.events.emit("updateQueue");
                                            done()
                                        });
                                    });
                                })
                                .on('error', cancel)
                                .save(cachePath);
                        } catch (e) {
                            cancel(e);
                        }
                    };

                    fs.exists(cachePath, (exist) => {
                        // Delete if already cached (e.g.: crashed mid transcoding)
                        if (exist) {
                            fs.unlink(cachePath, go);
                        } else {
                            go();
                        }
                    })
                }
            });
        }
    };

    state.playing = null;

    state.playNextSong = () => {
        // Check if song is already playing, and stop
        let last = null;
        if (state.playing) {
            last = state.playing;
            last.stream.emit("stop")
        }

        // Get next song to play (more votes, or random but not twice in a row)
        let nextSong = null;
        let totalVotes = 0;

        const queueReady = state.queue.filter((song) => song.ready);
        queueReady.forEach((song) => {
            if (!nextSong) {
                nextSong = song;
            } else {
                if (song.votes > nextSong.votes) {
                    nextSong = song;
                }
            }
            totalVotes += song.votes;
        });

        // If there were no votes, let's get a random (but not last)
        if (totalVotes === 0) {
            const queue = last ? queueReady.filter((song) => song.uuid !== last.source.uuid) : queueReady;
            nextSong = queue[Math.floor(Math.random() * queue.length)];
        }

        // Reset votes
        nextSong.votes = 0;

        // Play
        const stream = play(shout, `cache/${nextSong.uuid}.mp3`);
        stream.on("finish", state.playNextSong);
        stream.on("error", (error) => {
            stream.emit("stop");
            console.log(error);
            state.playNextSong()
        });

        state.playing = {
            stream,
            source: nextSong
        };

        state.events.emit("updateCurrent");
        state.events.emit("updateQueue");
    };


    // Make cache dir if doesn't exist
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
    }

    const cacheToQueue = [];
    // Add default songs
    songs.forEach((song) => {
        song.by = "BOT";
        cacheToQueue.push((callback) => {
            state.addToQueue(song, true, callback);
        })
    });
    // Add pre-cached songs
    readCache((cache) => {
        cache.forEach((cachedSong) => {
            // If default, don't readd
            if (!songs.find((song) => song.path === cachedSong.path)) {
                cacheToQueue.push((callback) => {
                    state.addToQueue({
                        path: cachedSong.path,
                    }, true, callback);
                })
            }
        });
        async.parallel(cacheToQueue,
            () => {
                // Once done checking cache, start playing
                state.playNextSong();

                setTimeout(() => {
                    // Reload already connected clients
                    state.events.emit("reload");
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

const cacheFilePath = path.resolve(cacheDir, 'cache.json');
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
