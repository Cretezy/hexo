import React, {Component} from 'react';
import './App.css';
import socket from 'socket.io-client';
import {HOST, ICECAST} from "./hosts";

class App extends Component {
    constructor() {
        super();
        this.socket = socket(HOST);

        this.socket.on('songList', (futureSongs) => {
            this.setState({futureSongs});
        });

        this.socket.on('currentSong', (currentSong) => {
            this.setState({currentSong});
        });

        this.state = {
            volume: parseFloat(localStorage.getItem("volume")) || 0.75,
            futureSongs: null,
            currentSong: null,
            muted: false,
            stopped: false,
        }
    }

    toggleStop() {
        if (this.state.stopped) {
            // start
            this.player.load()
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

    render() {
        return (
            <div className="App">
                <div className="App-header">
                    <h2>Welcome to Hexo v1.1.0</h2>
                </div>

                <audio
                    ref={(player) => {
                        this.player = player;
                    }}
                    autoPlay src={ICECAST}/>

                <input className="volume" type="range"
                       onChange={this.setVolume.bind(this)}
                       value={this.state.volume}
                       min="0" max="1" step="0.01"/>

                <br/>
                <br/>
                <br/>

                <button onClick={this.reloadAudio.bind(this)} disabled={this.state.stopped}>Refresh audio</button>
                <button onClick={this.toggleMute.bind(this)}>Toggle mute ({this.state.muted ? "on" : "off"})</button>
                <button onClick={this.toggleStop.bind(this)}>{this.state.stopped ? "Start" : "Stop"} audio</button>
                <button onClick={this.skip.bind(this)}>Skip</button>
                <br/>
                <br/>
                <hr/>

                {this.state.currentSong &&
                <h2>Currently playing: {this.state.currentSong.name}</h2>}

                {this.state.futureSongs
                    ? <SongList songs={this.state.futureSongs}/>
                    : <div>Loading future songs...</div>}
            </div>
        );
    }
}

function SongList({songs}) {
    return (
        <div>
            <h2>Future possible songs (random)</h2>
            {songs.map(
                (song) => <Song key={song.path} song={song}/>
            )}
        </div>
    );
}
function Song({song}) {
    return (
        <div>{song.name}</div>
    );
}

export default App;
