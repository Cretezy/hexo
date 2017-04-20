module.exports

const songs = {};

songs.types = {
    LOCAL: 0,
    YOUTUBE: 1
};

songs.songs = [
    {name: "wHere dA blOW", path: "./songs/skimask-wheredablow.mp3", type: songs.types.LOCAL},
    {name: "lOok aT meEEE", path: "./songs/xxxtentacion-lookatme.mp3", type: songs.types.LOCAL},
    {name: "sidEeAlkS", path: "./songs/theweeknd-sidewalks.mp3", type: songs.types.LOCAL},
//    {name: "heartlessss", path: "https://www.youtube.com/watch?v=Co0tTeuUVhU", type: YOUTUBE}
];

songs.lastSong = -1;


songs.getNextSong = () => {
    if (songs.lastSong === -1) {
        const index = Math.floor(Math.random() * songs.songs.length);
        songs.lastSong = index;
        return songs.songs[index];
    } else {
        const index = Math.floor(Math.random() * (songs.songs.length - 1));
        const nextSongs = songs.getFutureSongs();
        const nextSong = nextSongs[index];
        songs.songs.find((song, index) => {
            if (JSON.stringify(nextSong) === JSON.stringify(song)) {
                songs.lastSong = index;
                return true;
            } else {
                return false;
            }
        });
        return nextSong;
    }
};

songs.getFutureSongs = () => {
    return songs.songs.filter((song, songIndex) => {
        return songIndex !== songs.lastSong;
    });
};

module.exports = songs;