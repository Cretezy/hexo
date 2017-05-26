import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import 'mini.css/dist/mini-dark.min.css';
import './index.css';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(
  <App />,
  document.getElementById('root')
);

registerServiceWorker();