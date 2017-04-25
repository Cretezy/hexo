const uuid = require('uuid/v4');

module.exports = (state) => {
    const {io, events} = state;
    const connections = [];
    io.on('connection', (socket) => {
        const connection = {socket, name: "", uuid: uuid()};
        connections.push(connection);
        updateCurrent(socket);
        updateQueue(socket);
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
            events.emit("updateQueue");
        });

        // TODO: add logic to check if on server reload, and in prod
        // socket.on('reconnect', () => {
        //     socket.emit("reconnect")
        // });

        socket.on('skip', () => {
            state.playNextSong();
        });

        socket.on('addSong', (path) => {
            if (connection.name) {
                state.addToQueue({
                    path,
                    by: connection.name
                }, false, () => {
                    socket.emit('addedSong');
                }, () => {
                    socket.emit('addedSong');
                });
            }
        });

        socket.on('disconnect', () => {
            connections.splice(connections.indexOf(connection), 1);
            updateOnline();
        });
    });

    events.on("updateQueue", () => {
        updateQueue(io);
    });
    events.on("updateCurrent", () => {
        updateCurrent(io);
    });

    events.on("updateCurrent", () => {
        updateCurrent(io);
    });
    events.on("reload", () => {
        reload();
    });


    function updateCurrent(client) {
        if (state.playing) {
            client.emit('updateCurrent', state.playing.source);
        }
    }

    function updateQueue(client) {
        client.emit('updateQueue', state.queue);
    }

    function updateOnline() {
        io.emit('online',
            connections
                .filter((connection) => connection.name)
                .map((connection) => ({name: connection.name, uuid: connection.uuid}))
        );
    }

    function reload() {
        io.emit('reload');
    }
};
