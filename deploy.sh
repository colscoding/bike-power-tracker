#!/bin/bash

rm ~/colscoding.github.io/*
rm -r ~/colscoding.github.io/assets
npm run build
cp -r ~/bike-power-tracker/packages/client/dist/* ~/colscoding.github.io
cp ~/bike-power-tracker/deploy/CNAME ~/colscoding.github.io/CNAME
