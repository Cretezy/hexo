# Hexo

Install `node` (must be visible at `/usr/local/bin/node`)

If you want node to be able to bind to port 80/443
```bash
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```

Install deps
```bash
sudo apt install ffmpeg icecast2 libshout3-dev youtube-dl python
```

Create user:
```bash
useradd -m hexo
# usermod -aG sudo hexo # if you want sudo
# su - hexo # switches to user
```
Clone to `/home/hexo/hexo` & `cd` into it

Create default config & install
```bash
yarn run copy-defaults
yarn run update
```

Edit config (change password, etc)
* `icecast/icecast2/icecast2.xml`
* `.env`

Enable (on boot) and run
```bash
yarn run enable 
yarn run start 
```
