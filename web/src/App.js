import React, {Component} from 'react';
import './App.css';
import socket from 'socket.io-client';
import {HOST, ICECAST} from "./hosts";
import classNames from 'classnames';

class App extends Component {
    constructor() {
        super();
        this.socket = socket(HOST);

        this.socket.on('songList', (futureSongs) => {
            this.setState({futureSongs});
        });

        this.socket.on('currentSong', (currentSong) => {
            this.setState({currentSong});
            document.title = "Hexo | " + currentSong.name;
        });

        this.state = {
            volume: parseFloat(localStorage.getItem("volume")) || 0.75,
            futureSongs: null,
            currentSong: null,
            muted: false,
            stopped: true,
            songInput: "",
        }
    }

    toggleStop() {
        if (this.state.stopped) {
            // start
            this.player.load();
            this.player.play();
        } else {
            // stop
            this.player.pause()
        }

        this.setState((prevState) => ({stopped: !prevState.stopped}));
    }

    setVolume(event) {
        const volume = event.target.value;
        this.setState({volume}, this.refreshVolume);
        localStorage.setItem('volume', volume);
    }

    skip() {
        this.socket.emit('skip');
    }

    refreshVolume() {
        if (this.state.muted) {
            this.player.volume = 0;
        } else {
            this.player.volume = this.state.volume;
        }
    }

    componentDidMount() {
        this.player.volume = this.state.volume;
    }

    reloadAudio() {
        this.player.load();
    }

    toggleMute() {
        this.setState((prevState) => ({muted: !prevState.muted}), this.refreshVolume);
    }

    changeSongInput(event) {
        this.setState({songInput: event.target.value});
    }

    addSong(event) {
        event.preventDefault();
        this.socket.emit("addSong", this.state.songInput);
        this.setState({songInput: ""});
    }

    onVote(uuid) {
        return () => {
            this.socket.emit("vote", uuid)
        }
    }

    render() {
        return (
            <div className="App">
                <div className="App-header">
                    <h2>Welcome to Hexo v2.0.3</h2>
                </div>

                <audio
                    ref={(player) => {
                        this.player = player;
                    }}
                    src={ICECAST}/>

                <input className="volume" type="range"
                       onChange={this.setVolume.bind(this)}
                       value={this.state.volume}
                       min="0" max="1" step="0.005"/>

                <br/>
                <br/>

                <div>
                    <button onClick={this.toggleStop.bind(this)}
                            className="button blue">
                        {this.state.stopped ? "Start" : "Stop"} audio
                    </button>
                </div>
                <div>
                    <button onClick={this.reloadAudio.bind(this)}
                            className="button green small" disabled={this.state.stopped}>
                        Refresh audio
                    </button>
                    <button onClick={this.toggleMute.bind(this)}
                            className={classNames("button small", this.state.muted ? "red" : "blue")}>
                        Toggle mute ({this.state.muted ? "on" : "off"})
                    </button>
                </div>
                <div>
                    <button onClick={this.skip.bind(this)}
                            className="button red">
                        Skip song
                    </button>
                </div>

                <br/>
                <br/>

                {this.state.currentSong &&
                <h2>Currently playing: {this.state.currentSong.name}</h2>}

                {this.state.futureSongs
                    ? <SongList songs={this.state.futureSongs} onVote={this.onVote.bind(this)}/>
                    : <div>Loading future songs...</div>}

                <form onSubmit={this.addSong.bind(this)}>
                    <input value={this.state.songInput} onChange={this.changeSongInput.bind(this)}/>
                    <input type="submit" value="Add song"/>
                </form>
            </div>
        );
    }
}

function SongList({songs, onVote}) {
    // Sort by number of votes
    songs.sort(function (a, b) {
        return (a.votes < b.votes) ? 1 : ((b.votes < a.votes) ? -1 : 0);
    });

    return (
        <div>
            <h3>Queue</h3>
            {songs.map(
                (song) => <Song key={song.uuid} song={song} onVote={onVote}/>
            )}
        </div>
    );
}
function Song({song, onVote}) {
    return (
        <div>
            <button onClick={onVote(song.uuid)}>Votes ({song.votes})</button>
            {song.name}</div>
    );
}

export default App;
