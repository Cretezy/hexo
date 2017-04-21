const uuid = require('uuid/v4');

module.exports = (state) => {
    const {io, events} = state;
    const connections = [];
    io.on('connection', (client) => {
        sendCurrent(client);
        let name;
        client.on('setName', (newName) => {
            name = newName;
        });

        client.on('chat', (text) => {
            if (text && name) {
                io.emit('chat', {name, text, time: new Date().getTime(), uuid: uuid()});
            }
        });

        client.on('vote', (uuid) => {
            state.queue.find((song) => song.uuid === uuid).votes++;
            events.emit("updateSongList");
        });

        client.on('skip', () => {
            console.log("SKIP");
            state.current.stop();
            // state.songsManager.playNextSong();
        });

        client.on('addSong', (path) => {
            // console.log(path)
            state.songsManager.addToQueue({path, type: state.types.YOUTUBE, by: name, title: ""});
            // events.emit("updateSongList");
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
        client.emit('songList', state.queue.filter((song) => song.title !== ""));
    }
};
