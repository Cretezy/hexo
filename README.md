# Hexo

Install `node` (must be visible at `/usr/local/bin/node`)

To make node be able to bind to port 80/443:
```bash
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```
Install deps:
```bash
sudo apt install ffmpeg icecast2 ices2 libshout3-dev youtube-dl python
```

Create user:
```bash
useradd -m hexo
# usermod -aG sudo hexo # if you want sudo
```

```bash
yarn run copy-defaults
```

Edit
* `icecast/icecast2/icecast2.xml`
* `icecast/ices2/ices2.xml`
* `.env`


```bash
yarn run build
yarn run install 
yarn run enable 
yarn run start 
```
