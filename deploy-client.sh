#!/bin/bash

rm -r ~/colscoding.github.io/assets
rm ~/colscoding.github.io/*
pnpm run build:client
cp -r ~/bike-power-tracker/packages/client/dist/* ~/colscoding.github.io
cp ~/bike-power-tracker/deploy/CNAME ~/colscoding.github.io/CNAME
