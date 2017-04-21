const uuid = require('uuid/v4');

module.exports = (state) => {
    const {io, events} = state;
    const connections = [];
    io.on('connection', (socket) => {
        const connection = {socket, name: "", uuid: uuid()};
        connections.push(connection);
        updateCurrent(socket);
        updateOnline();

        socket.on('setName', (newName) => {
            connection.name = newName;
            updateOnline();
        });

        socket.on('chat', (text) => {
            if (text && connection.name) {
                io.emit('chat', {
                    name: connection.name, text,
                    time: new Date().getTime(), uuid: uuid()
                });
            }
        });

        socket.on('vote', (uuid) => {
            state.queue.find((song) => song.uuid === uuid).votes++;
            events.emit("updateSongList");
        });

        socket.on('skip', () => {
            state.current.stop();
        });

        socket.on('addSong', (path) => {
            if (connection.name) {
                state.songsManager.addToQueue({
                    path, type: state.types.YOUTUBE,
                    by: connection.name, title: ""
                });
            }
        });

        socket.on('disconnect', () => {
            console.log("disconnect", connections.indexOf(connection));
            connections.splice(connections.indexOf(connection), 1);
            updateOnline();
        });
    });

    events.on("play", () => {
        updateCurrent(io);
    });

    events.on("updateSongList", () => {
        updateCurrent(io);
    });

    function updateCurrent(client) {
        client.emit('currentSong', state.current.source);
        client.emit('songList', state.queue.filter((song) => song.title !== ""));
    }

    function updateOnline() {
        io.emit('online',
            connections
                .filter((connection) => connection.name)
                .map((connection) => ({name: connection.name, uuid: connection.uuid}))
        );
    }
};
