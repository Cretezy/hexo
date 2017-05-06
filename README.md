# Hexo

Custom web radio with voting. Plays songs from YouTube/SoundCloud.

## Description

Hexo is a 3 part project, compromised of the server, Icecast (the audio server), and the front-end (`web`).

* The React front-end simply plays the audio from the audio server, and shows the queue and voting list.

* The server connects to the clients (front-end) and syncs queue/voting/chat, and it handles sending audio to the Icecast server.

* The Icecast server is simply an radio/broadcast server which intakes from a "source" (the server), and streams to multiple clients (the front-end).

This allows Hexo to sync the same song to many clients. It downloads songs from YouTube or SoundCloud (more to come) using `youtube-dl` and caches it to playback. This makes running Hexo is probably against YouTube's and SoundCloud's terms of service.

## Setup

* Install `node` (must be visible at `/usr/local/bin/node`, you can symlink to that path)

* Install dependencies
    ```bash
    sudo apt install ffmpeg icecast2 libshout3-dev youtube-dl python
    ```

* Create user (with home directory (`-m`))
    ```bash
    useradd -m hexo
    
    # usermod -aG sudo hexo # if you want sudo
    ```

* Switch to user
    ```bash
    su - hexo
    ```
    
* Clone
    ```bash
    # should be at /home/hexo
    git clone git@github.com:Cretezy/hexo.git
    cd hexo
    ```


* Create default config & setup
    ```bash
    yarn run copy-defaults
    yarn run update
    ```

* Edit config (change password, etc)
    * `icecast/icecast2.xml`
    * `.env`

* Enable (on boot) and run
    ```bash
    yarn run enable 
    yarn run start 
    ```

**Note**: You probably want to run behind a reverse proxy (like nginx) and add SSL.

### Update
```bash
yarn run update
yarn run restart
```