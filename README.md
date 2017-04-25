# Hexo

Install `node` (must be visible at `/usr/local/bin/node`)

Create user: 
```bash
useradd -m hexo
# usermod -aG sudo hexo
```

Install deps:
```bash
sudo apt install ffmpeg icecast2 ices2 libshout3-dev youtube-dl python
```

```bash
yarn run build
yarn run install 
yarn run enable 
yarn run start 
```

Change password:
* `icecast/icecast2/icecast.xml`
* `icecast/ices2/ices-playlist.xml`
* `.env`

```bash
yarn start
```