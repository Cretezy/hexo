module.exports = (io, songs) => {
    io.on('connection', (client) => {
        client.emit('currentSong', songs.songs[songs.lastSong]);
        client.emit('songList', songs.getFutureSongs());

        client.on('vote', (data) => {
        });
        client.on('disconnect', () => {
        });
    });

    return () => {
        io.emit('currentSong', songs.songs[songs.lastSong]);
        io.emit('songList', songs.getFutureSongs());
    }
};