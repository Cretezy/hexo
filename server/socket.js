module.exports = (state) => {
    const {io, events} = state;
    io.on('connection', (client) => {
        sendCurrent(client);

        client.on('vote', (uuid) => {
            state.queue.find((song)=> song.uuid === uuid).votes++;
            events.emit("updateSongList");
        });

        client.on('skip', () => {
            state.songsManager.playNextSong();
        });

        client.on('addSong', (path) => {
            // console.log(path)
            state.songsManager.addToQueue({path, type: state.types.YOUTUBE});
            events.emit("updateSongList");
        });

        client.on('disconnect', () => {
        });
    });

    events.on("play", () => {
        sendCurrent(io);
    });

    events.on("updateSongList", () => {
        sendCurrent(io);
    });

    function sendCurrent(client) {
        client.emit('currentSong', state.current.source);
        client.emit('songList', state.queue);
    }
};
