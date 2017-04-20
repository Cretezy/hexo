(cd web && yarn build)
rsync --copy-links -r  --exclude=*/node_modules . root@hexo.craftthatblock.com:/root/hexo
ssh root@hexo.craftthatblock.com "bash -ic /root/hexo.sh"
