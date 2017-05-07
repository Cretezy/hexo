import React, {Component} from 'react';
import './App.css';
import socket from 'socket.io-client';
import {HOST, ICECAST} from "./hosts";
import classNames from 'classnames';

class App extends Component {
    constructor() {
        super();
        this.socket = socket(HOST);

        this.socket.on('updateCurrent', (data) => {
            this.setState({
                currentlyPlaying: data
            });
            document.title = "Hexo | " + data.title;
            this.setState({
                currentUpVote: null, currentDownVote: null,
            })
        });
        this.socket.on('updateQueue', (queue) => {
            this.setState({queue});
        });

        this.socket.on('chat', (chat) => {
            this.setState((prevState) => ({messages: prevState.messages.concat(chat)}));
        });

        this.socket.on('online', (online) => {
            this.setState({users: online});
        });

        this.socket.on('addedSong', () => {
            this.setState({songInput: "", songAdding: false});
        });

        this.socket.on('reload', () => {
            if (!this.state.stopped) {
                this.reloadAudio();
            }
            this.socket.emit("setName", this.state.name);
            this.setState({
                songAdding: false
            })
        });

        const name = localStorage.getItem("name") || "";
        if (name !== "") {
            this.socket.emit("setName", name);
        }

        this.state = {
            volume: parseFloat(localStorage.getItem("volume")) || 0.75,
            queue: null,
            currentlyPlaying: null,
            muted: false,
            stopped: true,
            songAdding: false,
            songInput: "",
            chatInput: "",
            nameInput: "",
            name,
            messages: [],
            users: [],
            currentUpVote: null,
            currentDownVote: null
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
        this.player.play();
        if (!this.player.paused) {
            this.setState({stopped: false});
        } else {
            this.player.load();
        }
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
        if (!this.state.songAdding) {
            this.socket.emit("addSong", this.state.songInput);
            this.setState({songAdding: true});
        }
    }

    onUpVote(uuid) {
        this.socket.emit("upVote", uuid);
        this.setState({currentUpVote: uuid});

        if (this.state.currentDownVote === uuid) {
            this.setState({currentDownVote: null});
        }
    }

    onDownVote(uuid) {
        this.socket.emit("downVote", uuid);
        this.setState({currentDownVote: uuid});

        if (this.state.currentUpVote === uuid) {
            this.setState({currentUpVote: null});
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
                    <h2>Welcome to Hexo v5.1.0</h2>
                </div>

                <div className="container">
                    <div className="row">
                        <div className="col-sm-12 col-md-6 col-lg-4">
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
                            <div className="button-group">
                                <button onClick={this.toggleStop.bind(this)}
                                        className="primary">
                                    {this.state.stopped ? "Start" : "Stop"} audio
                                </button>
                                <button onClick={this.skip.bind(this)}
                                        className="secondary">
                                    Skip song
                                </button>
                            </div>
                            <div className="button-group">
                                <button onClick={this.reloadAudio.bind(this)}
                                        className="tertiary" disabled={this.state.stopped}>
                                    Refresh audio
                                </button>
                                <button onClick={this.toggleMute.bind(this)}
                                        className={classNames("", this.state.muted ? "secondary" : "primary")}>
                                    Toggle mute ({this.state.muted ? "on" : "off"})
                                </button>
                            </div>

                            {this.state.currentlyPlaying &&
                            <div>
                                <br/>
                                <h3>Currently playing</h3>
                                <h4>{this.state.currentlyPlaying.title}</h4>
                                <br/>
                                {this.state.currentlyPlaying.thumbnail &&
                                <img alt={this.state.currentlyPlaying.title}
                                     src={this.state.currentlyPlaying.thumbnail}/>}
                                <br/>
                                <a
                                    className="button small"
                                    target="_blank"
                                    style={{fontSize: "small", textDecoration: "none"}}
                                    href={"https://www.google.com/search?btnI&q=site%3Agenius.com+" +
                                    encodeURIComponent(this.state.currentlyPlaying.title).replace(/%20/g, '+')}>
                                    Lyrics
                                </a>
                            </div>}
                        </div>

                        <div className="col-sm-12 col-md-6 col-lg-8">
                            <div className="container">
                                <div className="row">
                                    <div className="col-sm-12 col-md-12 col-lg-6">
                                        {this.state.queue
                                            ? <SongList songs={this.state.queue}
                                                        onUpVote={this.onUpVote.bind(this)}
                                                        onDownVote={this.onDownVote.bind(this)}
                                                        currentUpVote={this.state.currentUpVote}
                                                        currentDownVote={this.state.currentDownVote}
                                            />
                                            : <div>Loading future songs...</div>}
                                        {this.state.name !== "" &&
                                        <form onSubmit={this.addSong.bind(this)}>
                                            <input
                                                placeholder="YouTube or SoundCloud URL"
                                                disabled={this.state.songAdding}
                                                value={this.state.songInput}
                                                onChange={this.changeInput("songInput").bind(this)}/>
                                            <input type="submit" disabled={this.state.songAdding} value="Add song"/>
                                        </form>
                                        }
                                    </div>
                                    <div className="col-sm-12 col-md-12 col-lg-6">
                                        <OnlineUsers users={this.state.users}/>

                                        {this.state.name !== "" ?
                                            <div>
                                                <form onSubmit={this.sendChat.bind(this)}>
                                                    <input
                                                        value={this.state.chatInput}
                                                        onChange={this.changeInput("chatInput").bind(this)}/>
                                                    <input type="submit" value="Send"/>
                                                </form>
                                            </div>
                                            :
                                            <form onSubmit={this.setName.bind(this)}>
                                                <input
                                                    value={this.state.nameInput}
                                                    onChange={this.changeInput("nameInput").bind(this)}/>
                                                <input type="submit" value="Set name"/>
                                            </form>
                                        }
                                        <ChatList messages={this.state.messages}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

function SongList({songs, onUpVote, onDownVote, currentUpVote, currentDownVote}) {
    // Sort by number of votes
    songs.sort(function (a, b) {
        const aVotes = a.votes + a.upVotes - a.downVotes;
        const bVotes = b.votes + b.upVotes - b.downVotes;
        return (aVotes < bVotes) ? 1 : ((bVotes < aVotes) ? -1 : 0);
    });

    return (
        <div>
            <h3>Queue</h3>
            {songs.map(
                (song) => <Song
                    key={song.uuid}
                    song={song}
                    onUpVote={onUpVote} onDownVote={onDownVote}
                    currentUpVote={currentUpVote} currentDownVote={currentDownVote}/>
            )}
        </div>
    );
}
function Song({song, onUpVote, onDownVote, currentUpVote, currentDownVote}) {
    return (
        <div className="row" style={{paddingBottom: '15px'}}>
            <div className="col-sm-12 col-md-3 ">
                <button className={classNames({vote: true, upVoted: currentUpVote === song.uuid})} onClick={() => {
                    if (song.ready) {
                        onUpVote(song.uuid)
                    }
                }}>
                    &uarr;
                </button>
                <button className={classNames({vote: true, downVoted: currentDownVote === song.uuid})} onClick={() => {
                    if (song.ready) {
                        onDownVote(song.uuid)
                    }
                }}>
                    &darr;
                </button>

                <br/>

                <span className="votes">
                    <span>
                        {song.votes}
                    </span>
                    <span>
                        +{song.upVotes}
                    </span>
                    <span>
                        -{song.downVotes}
                    </span>
                     <span>
                        = {song.votes + song.upVotes - song.downVotes}
                    </span>
                </span>
            </div>


            <div className="col-sm-12 col-md-9">
                <span>
                    <strong>{song.by}</strong> - <span style={!song.ready ? {color: "gray"} : {}}>{song.title}
                    <span style={{fontSize: "small"}}> {song.duration}</span>
                </span>
                    </span>
            </div>
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
        <div className="message">
            <strong>{message.name}</strong>: {message.text}
        </div>
    );
}

function OnlineUsers({users}) {
    return (
        <div>
            {users.length > 0 && <div>
                <h3>Online Users</h3></div>}
            {users.map(
                (user) => <div key={user.uuid}>{user.name}</div>
            )}
        </div>
    );
}

export default App;
