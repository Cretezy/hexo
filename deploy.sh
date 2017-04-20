(cd web && yarn build)
rsync --copy-links -r . root@hexo.craftthatblock.com:/root/hexo
ssh root@hexo.craftthatblock.com "bash -ic /root/hexo.sh"
