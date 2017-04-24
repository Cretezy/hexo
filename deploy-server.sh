rsync --copy-links -r  --exclude=*/node_modules --exclude=server/cache . hexo:/root/hexo
ssh hexo "bash -ic /root/hexo.sh"
