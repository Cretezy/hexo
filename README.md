# Hexo

Install `node` (must be visible at `/usr/local/bin/node`)

Create user: 
```bash
useradd -m hexo
```

Install deps:
```bash
sudo apt install ffmpeg icecast2 ices2 libshout3-dev
```

```bash
yarn run install 
yarn run build
```

Change password:
* `icecast/icecast2/icecast.xml`
* `icecast/ices2/ices-playlist.xml`
* `server/.env`

```bash
yarn start
```