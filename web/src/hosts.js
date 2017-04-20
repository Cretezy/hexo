export const ICECAST = process.env.REACT_APP_ICECAST_HOST
    ? process.env.REACT_APP_ICECAST_HOST + '/hexo'
    : 'http://localhost:8000/hexo';
export const HOST = process.env.REACT_APP_HOST || "http://localhost:9000";