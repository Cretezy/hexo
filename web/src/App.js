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
            document.title = "Hexo | " + currentSong.title;
        });

        this.socket.on('chat', (chat) => {
            this.setState((prevState) => ({messages: prevState.messages.concat(chat)}));
        });

        this.socket.on('online', (online) => {
            this.setState({users: online});
        });

        const name = localStorage.getItem("name") || "";
        if (name !== "") {
            this.socket.emit("setName", name);
        }

        this.state = {
            volume: parseFloat(localStorage.getItem("volume")) || 0.75,
            futureSongs: null,
            currentSong: null,
            muted: false,
            stopped: true,
            songInput: "",
            chatInput: "",
            nameInput: "",
            name,
            messages: [],
            users: [],
        }
    }

    toggleStop() {
        if (this.state.stopped) {
            // start
            this.reloadAudio()
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
        this.player.play();
    }

    toggleMute() {
        this.setState((prevState) => ({muted: !prevState.muted}), this.refreshVolume);
    }

    changeInput(input) {
        return (event) => {
            const state = {};
            state[input] = event.target.value;
            this.setState(state);
        }
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

    setName(event) {
        event.preventDefault();
        const name = this.state.nameInput;
        this.socket.emit("setName", name);
        this.setState({nameInput: "", name});
        localStorage.setItem('name', name);

    }

    sendChat(event) {
        event.preventDefault();
        this.socket.emit("chat", this.state.chatInput);
        this.setState({chatInput: ""});
    }

    render() {
        return (
            <div className="App">
                <div className="App-header">
                    <h2>Welcome to Hexo v3.2.1</h2>
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
                <h2>Currently playing: {this.state.currentSong.title}</h2>}

                {this.state.futureSongs
                    ? <SongList songs={this.state.futureSongs} onVote={this.onVote.bind(this)}/>
                    : <div>Loading future songs...</div>}
                {this.state.name !== "" &&
                <form onSubmit={this.addSong.bind(this)}>
                    <input value={this.state.songInput} onChange={this.changeInput("songInput").bind(this)}/>
                    <input type="submit" value="Add song"/>
                </form>
                }


                <OnlineUsers users={this.state.users}/>

                <hr/>
                {this.state.name !== "" ?
                    <div>
                        <form onSubmit={this.sendChat.bind(this)}>
                            <input value={this.state.chatInput} onChange={this.changeInput("chatInput").bind(this)}/>
                            <input type="submit" value="Send"/>
                        </form>
                    </div>
                    :
                    <form onSubmit={this.setName.bind(this)}>
                        <input value={this.state.nameInput} onChange={this.changeInput("nameInput").bind(this)}/>
                        <input type="submit" value="Set name"/>
                    </form>
                }

                <ChatList messages={this.state.messages}/>
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
            <button className="vote" onClick={onVote(song.uuid)}>Votes ({song.votes})</button>
            <strong>{song.by}</strong> - {song.title}
        </div>
    );
}


function ChatList({messages}) {
    // Sort by time (new up)
    messages.sort(function (a, b) {
        return (a.time < b.time) ? 1 : ((b.time < a.time) ? -1 : 0);
    });

    return (
        <div>
            <h3>Chat</h3>
            {messages.map(
                (message) => <Message key={message.uuid} message={message}/>
            )}
        </div>
    );
}
function Message({message}) {
    return (
        <div>
            <strong>{message.name}</strong>: {message.text}
        </div>
    );
}

function OnlineUsers({users}) {
    return (
        <div>
            {users.length > 0 && <div><hr/><h3>Online Users</h3></div>}
            {users.map(
                (user) => <div key={user.uuid}>{user.name}</div>
            )}
        </div>
    );
}

export default App;
