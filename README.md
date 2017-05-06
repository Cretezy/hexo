# Hexo

Custom web radio with voting. Plays songs from YouTube/SoundCloud.

## Setup

* Install `node` (must be visible at `/usr/local/bin/node`)

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