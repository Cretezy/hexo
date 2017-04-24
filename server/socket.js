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
            events.emit("update");
        });

        // TODO: add logic to check if on server reload, and in prod
        // socket.on('reconnect', () => {
        //     socket.emit("reconnect")
        // });

        socket.on('skip', () => {
            // state.current.stop();
            state.songsManager.playNextSong(true);
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
            connections.splice(connections.indexOf(connection), 1);
            updateOnline();
        });
    });

    events.on("update", () => {
        updateCurrent(io);
    });


    function updateCurrent(client) {
        if (state.current) {
            client.emit('update', {
                currentlyPlaying: state.playing ? state.playing.source : state.current.source,
                currentlyLoading: state.loading.source,
                queue: state.queue.filter((song) => song.title !== "")
            });
        }
    }

    function updateOnline() {
        io.emit('online',
            connections
                .filter((connection) => connection.name)
                .map((connection) => ({name: connection.name, uuid: connection.uuid}))
        );
    }
};
