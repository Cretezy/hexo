module.exports = (state) => {
    const {io, events} = state;
    io.on('connection', (client) => {
        sendCurrent(client);

        client.on('vote', (data) => {
        });

        client.on('skip', () => {
            state.songsManager.playNextSong();
        });

        client.on('disconnect', () => {
        });
    });

    events.on("play", () => {
        sendCurrent(io);
    });

    function sendCurrent(client) {
        client.emit('currentSong', state.current.source);
        client.emit('songList', state.songsManager.getFutureSongs());
    }
};
