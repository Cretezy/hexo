rsync --copy-links -r  --exclude=*/node_modules . hexo:/root/hexo
ssh hexo "bash -ic /root/hexo.sh"
