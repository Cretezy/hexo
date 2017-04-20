import React, {Component} from 'react';
import './App.css';

class App extends Component {
    constructor() {
        super();
        this.state = {
            volume: parseFloat(localStorage.getItem("volume")) || 0.75
        }
    }

    setVolume(event) {
        const volume = event.target.value;
        this.player.volume = volume;
        this.setState({
            volume
        });
        localStorage.setItem('volume', volume);
    }

    componentDidMount() {
        this.player.volume = this.state.volume;
    }

    render() {
        return (
            <div className="App">
                <div className="App-header">
                    <h2>Welcome to Hexo v1.0.0</h2>
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
            </div>
        );
    }
}

export default App;
