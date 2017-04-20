import React, {Component} from 'react';
import './App.css';
import socket from 'socket.io-client';

class App extends Component {
    constructor() {
        super();
        this.socket = socket(`http://${process.env.REACT_APP_HOST || "localhost:9000"}`);

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
        }
    }

    setVolume(event) {
        const volume = event.target.value;
        this.setState({volume}, this.refreshVolume);
        localStorage.setItem('volume', volume);
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
                    autoPlay src={process.env.REACT_APP_ICECAST || "http://localhost:8000/hexo"}/>
                <input className="volume" type="range"
                       onChange={this.setVolume.bind(this)}
                       value={this.state.volume}
                       min="0" max="1" step="0.01"/>

                <br/>
                <br/>
                <br/>

                <button onClick={this.reloadAudio.bind(this)}>Refresh audio</button>
                <button onClick={this.toggleMute.bind(this)}>Toggle mute</button>

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
