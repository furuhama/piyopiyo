---
layout: post
title: qemu で raspbian のエミュレート(環境構築メモ)
date: 2018-03-12 23:00:00 +0900
tag: [os, qemu, raspbian]
---

xv6 の勢いで raspbian を動かそうと思い立ち、同じくメモ。

raspbian は xv6 より現代的なアーキテクチャ向けに作られているから簡単っぽい

と、思ってたら意外とめんどくさく、最初は stretch を動かそうと思ってたけど簡単な jessie にした

--

### 僕の環境

- OSX High Sierra 10.13.3

--

### 必要なもの(Homebrewとか自前ビルドとかで)

- qemu
- raspbian jessie
- kernel
  - RPi Kernel を直接 qemu で動かすことはできないので、カスタムされたカーネルを用いる

--

### 必要なもののバージョン

- qemu 2.11.1
- raspbian jessie(2016-11-25-raspbian-jessie)
  - 日本だと本家より北陸先端大学のミラーを落とす方が早いみたい
  - `$ wget http://ftp.jaist.ac.jp/pub/raspberrypi/raspbian_lite/images/raspbian_lite-2016-11-29/2016-11-25-raspbian-jessie-lite.zip`
- kernel(kernel-qemu-4.9.59-stretch)
  - [ここ](https://github.com/dhruvvyas90/qemu-rpi-kernel)から git clone するなり 欲しいやつだけもってくるなり
  - `$ wget https://github.com/dhruvvyas90/qemu-rpi-kernel/raw/master/kernel-qemu-4.4.34-jessie`

--

### 初回起動

```
$ qemu-system-arm -kernel ./kernel-qemu-4.4.34-jessie \
-cpu arm1176 -m 256 \
-M versatilepb -no-reboot -serial stdio \
-append "root=/dev/sda2 panic=1 rootfstype=ext4 rw init=/bin/bash" \
-drive "file=2016-11-25-raspbian-jessie-lite.img,index=0,media=disk,format=raw"
```

![start](/images/2018-03-14-qemu-raspbian/01_start.png)

### 生成されたファイルの書き換え

たぶん立ち上がった raspbian の中でこのコマンドやるってことだと思う

```
$ sed -i -e 's/^/#/' /etc/ld.so.preload
$ sed -i -e 's/^/#/' /etc/fstab
```

### 以降の起動

bash での init を消しつつ最後にポートのオプションを加えるだけ

```
$ qemu-system-arm -kernel ./kernel-qemu-4.4.34-jessie \
-cpu arm1176 -m 256 \
-M versatilepb -no-reboot -serial stdio \
-append "root=/dev/sda2 panic=1 rootfstype=ext4 rw" \
-drive "file=2016-11-25-raspbian-jessie-lite.img,index=0,media=disk,format=raw" \
-net user,hostfwd=tcp::5022-:22
```

立ち上がった！

![standup](/images/2018-03-14-qemu-raspbian/02_standup.png)

これでホストマシンの 5022 番ポートと仮想マシンの 22 番ポートを結んでいる

はずなんだけど `ssh -p 5022` ができない、、

またあとで調べよう

--

参考:

- [Using QEMU to emulate a Raspberry Pi](https://blog.agchapman.com/using-qemu-to-emulate-a-raspberry-pi/)
- [How to emulate a Raspberry Pi (Raspbian Jessie) on Mac OSX (Sierra)](https://gist.github.com/MrAndersonMD/d0d1506a91855d7a022b8cc8d0576b79)

