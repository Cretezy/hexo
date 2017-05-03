const uuid = require('uuid/v4');

module.exports = (state) => {
    const {io, events} = state;
    const connections = [];
    state.connections = connections;

    io.on('connection', (socket) => {
        const connection = {socket, name: "", uuid: uuid(), upVote: null, downVote:null};
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

        socket.on('upVote', (uuid) => {
            connection.upVote = uuid;
            if(connection.downVote === uuid){
                connection.downVote = null;
            }
            events.emit("updateQueue");
        });

        socket.on('downVote', (uuid) => {
            connection.downVote = uuid;
            if(connection.upVote === uuid){
                connection.upVote = null;
            }
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
            updateQueue(io)
        });
    });

    events.on("updateQueue", () => {
        updateQueue(io);
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
        client.emit('updateQueue',
            state.queue.map(song => Object.assign({}, song,
                {
                    upVotes: connections.filter((connection) => connection.upVote === song.uuid).length,
                    downVotes: connections.filter((connection) => connection.downVote === song.uuid).length,
                }
            )));
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
